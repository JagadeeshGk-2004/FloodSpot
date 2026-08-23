import Peer from 'peerjs';
import { saveToOfflineQueue, QUEUE_ITEM_TYPES } from './offlineEngine';

/**
 * FloodSpot Serverless WebRTC P2P Emergency Mesh Engine
 * -------------------------------------------------------------
 * Enables real-time peer-to-peer emergency SOS broadcasting and mesh messaging
 * between nearby devices without relying on central server availability.
 * Automatically falls back to LocalStorage queuing during network/signaling blackout.
 */

// Internal state variables
let localPeer = null;
let localPeerId = null;
const activeConnections = new Map(); // peerId -> DataConnection
const messageListeners = new Set();
const connectionListeners = new Set();
const disconnectionListeners = new Set();
const statusListeners = new Set();
const seenPacketIds = new Set();

// Current engine status: 'disconnected' | 'connecting' | 'connected' | 'offline_fallback' | 'error'
let engineStatus = 'disconnected';

/**
 * Updates internal status and notifies status listeners.
 * 
 * @param {string} status 
 * @param {Object} [metadata] 
 */
function updateStatus(status, metadata = {}) {
  engineStatus = status;
  statusListeners.forEach((listener) => {
    try {
      listener(engineStatus, metadata);
    } catch (err) {
      console.error('[P2PEngine] Error in status listener:', err);
    }
  });
}

/**
 * Helper to fetch device battery level if supported by browser API.
 * 
 * @returns {Promise<number|null>} Battery level percentage (0-100) or null
 */
export async function getBatteryLevel() {
  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      return Math.round(battery.level * 100);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Generates a unique, human-readable local Peer ID for FloodSpot device mesh.
 * 
 * @returns {string}
 */
export function generatePeerId() {
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `floodspot-node-${Date.now().toString(36)}-${randomStr}`;
}

/**
 * Initializes the local PeerJS node instance and attaches signaling event listeners.
 * 
 * @param {string} [requestedPeerId] Custom peer ID (optional)
 * @returns {Promise<string>} Resolved with local Peer ID
 */
export function initP2PEngine(requestedPeerId) {
  return new Promise((resolve) => {
    if (localPeer && !localPeer.destroyed) {
      console.log('[P2PEngine] Reusing existing PeerJS instance:', localPeerId);
      resolve(localPeerId);
      return;
    }

    const peerId = requestedPeerId || generatePeerId();
    updateStatus('connecting', { peerId });

    try {
      localPeer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      localPeer.on('open', (id) => {
        localPeerId = id;
        console.log('[P2PEngine] PeerJS engine initialized with ID:', id);
        updateStatus('connected', { peerId: id });
        resolve(id);
      });

      // Handle incoming P2P WebRTC data connections from other devices
      localPeer.on('connection', (conn) => {
        console.log('[P2PEngine] Incoming P2P connection from peer:', conn.peer);
        setupDataConnection(conn);
      });

      // Peer signaling & network error handler
      localPeer.on('error', (err) => {
        console.warn(`[P2PEngine] PeerJS signal alert (${err.type}):`, err.message || err);

        if (err.type === 'peer-unavailable') {
          // Non-fatal error when attempting to connect to offline peer
          return;
        }

        // Fall back to offline mode gracefully if cloud signaling server is unreachable
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'unavailable-id') {
          updateStatus('offline_fallback', { error: err.message, type: err.type });
        } else {
          updateStatus('error', { error: err.message, type: err.type });
        }

        // Resolve even on signaling failure so UI startup doesn't freeze
        resolve(peerId);
      });

      localPeer.on('disconnected', () => {
        console.warn('[P2PEngine] Peer disconnected from cloud signaling server.');
        updateStatus('offline_fallback', { reason: 'Signaling disconnected' });
        // Attempt automatic reconnection to signaling server if online
        if (typeof navigator !== 'undefined' && navigator.onLine && localPeer && !localPeer.destroyed) {
          try {
            localPeer.reconnect();
          } catch {
            // Ignore reconnect error
          }
        }
      });

      localPeer.on('close', () => {
        console.log('[P2PEngine] Local peer node closed.');
        updateStatus('disconnected');
      });

    } catch (err) {
      console.error('[P2PEngine] Failed to construct Peer instance:', err);
      updateStatus('offline_fallback', { error: err.message });
      resolve(peerId);
    }
  });
}

/**
 * Registers data channel handlers for an active P2P DataConnection.
 * 
 * @param {DataConnection} conn 
 */
function setupDataConnection(conn) {
  conn.on('open', () => {
    console.log(`[P2PEngine] WebRTC Data Channel OPEN with peer: ${conn.peer}`);
    activeConnections.set(conn.peer, conn);

    connectionListeners.forEach((listener) => {
      try {
        listener(conn.peer, conn);
      } catch (err) {
        console.error('[P2PEngine] Error in connection listener:', err);
      }
    });
  });

  conn.on('data', (rawPacket) => {
    handleIncomingPacket(rawPacket, conn.peer);
  });

  conn.on('close', () => {
    console.log(`[P2PEngine] Data Channel closed with peer: ${conn.peer}`);
    activeConnections.delete(conn.peer);

    disconnectionListeners.forEach((listener) => {
      try {
        listener(conn.peer);
      } catch (err) {
        console.error('[P2PEngine] Error in disconnection listener:', err);
      }
    });
  });

  conn.on('error', (err) => {
    console.warn(`[P2PEngine] Data Channel error with peer ${conn.peer}:`, err);
    activeConnections.delete(conn.peer);
  });
}

/**
 * Connects local device to a remote peer by target Peer ID.
 * 
 * @param {string} targetPeerId 
 * @returns {Promise<DataConnection|null>}
 */
export function connectToPeer(targetPeerId) {
  return new Promise((resolve) => {
    if (!targetPeerId || targetPeerId === localPeerId) {
      return resolve(null);
    }

    if (activeConnections.has(targetPeerId) && activeConnections.get(targetPeerId).open) {
      return resolve(activeConnections.get(targetPeerId));
    }

    if (!localPeer || localPeer.destroyed) {
      console.warn('[P2PEngine] Cannot connect to peer: engine not initialized.');
      return resolve(null);
    }

    try {
      console.log('[P2PEngine] Dialing P2P peer connection to:', targetPeerId);
      const conn = localPeer.connect(targetPeerId, {
        reliable: true
      });

      setupDataConnection(conn);

      conn.on('open', () => resolve(conn));
      conn.on('error', () => resolve(null));
    } catch (err) {
      console.error('[P2PEngine] Failed to initiate connection:', err);
      resolve(null);
    }
  });
}

/**
 * Processes incoming data packets over WebRTC data channels.
 * Performs duplicate deduplication and notifies dynamic UI subscribers.
 * 
 * @param {Object} packet 
 * @param {string} remotePeerId 
 */
function handleIncomingPacket(packet, remotePeerId) {
  if (!packet || typeof packet !== 'object') return;

  // Deduplicate packets by unique packet ID
  if (packet.id) {
    if (seenPacketIds.has(packet.id)) return;
    seenPacketIds.add(packet.id);
    
    // Keep deduplication memory bounded (max 500 packets)
    if (seenPacketIds.size > 500) {
      const firstKey = seenPacketIds.keys().next().value;
      seenPacketIds.delete(firstKey);
    }
  }

  console.log(`[P2PEngine] Received P2P packet (${packet.type}) from ${remotePeerId}:`, packet);

  // Notify registered dynamic UI listeners
  notifyMessageListeners(packet, remotePeerId);

  // Automatic mesh gossip propagation for SOS alerts if ttl permits
  if (packet.type === 'SOS_ALERT' && (packet.ttl === undefined || packet.ttl > 0)) {
    relayPacketToPeers(packet, remotePeerId);
  }
}

/**
 * Relays an emergency packet to all other connected mesh peers (gossip routing).
 * 
 * @param {Object} packet 
 * @param {string} excludePeerId 
 */
function relayPacketToPeers(packet, excludePeerId) {
  const relayedPacket = {
    ...packet,
    ttl: (packet.ttl !== undefined ? packet.ttl : 3) - 1
  };

  if (relayedPacket.ttl <= 0) return;

  for (const [peerId, conn] of activeConnections.entries()) {
    if (peerId !== excludePeerId && conn.open) {
      try {
        conn.send(relayedPacket);
      } catch {
        // Ignore send errors during relay
      }
    }
  }
}

/**
 * Helper to dispatch packet to UI message listeners.
 * 
 * @param {Object} packet 
 * @param {string} [senderId] 
 */
function notifyMessageListeners(packet, senderId = localPeerId) {
  messageListeners.forEach((listener) => {
    try {
      listener(packet, senderId);
    } catch (err) {
      console.error('[P2PEngine] Error in message listener:', err);
    }
  });
}

// ============================================================================
// 2. EMERGENCY BROADCAST SYSTEM
// ============================================================================

/**
 * Broadcasts an emergency SOS alert (coordinates, battery level, timestamp, message)
 * to all connected local WebRTC peers. If no connected peers or device is offline,
 * automatically saves payload to the LocalStorage offline queue (`saveToOfflineQueue`).
 * 
 * @param {Object} sosData - { latitude, longitude, message, batteryLevel, severity, ... }
 * @returns {Promise<{ sentCount: number, queuedOffline: boolean, packet: Object }>}
 */
export async function broadcastSOS(sosData = {}) {
  const battery = sosData.batteryLevel ?? await getBatteryLevel();

  const sosPayload = {
    user_id: sosData.user_id || null,
    user_name: sosData.user_name || 'Anonymous Peer',
    latitude: sosData.latitude || null,
    longitude: sosData.longitude || null,
    location_name: sosData.location_name || 'Emergency SOS Coordinates',
    battery_level: battery,
    severity: sosData.severity || 'critical',
    message: sosData.message || 'EMERGENCY SOS SIGNAL BROADCASTED VIA MESH',
    created_at: sosData.created_at || new Date().toISOString()
  };

  const packet = {
    id: `p2p_sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'SOS_ALERT',
    senderId: localPeerId || 'local-device',
    timestamp: new Date().toISOString(),
    ttl: 3,
    payload: sosPayload
  };

  let sentCount = 0;

  // Broadcast to all active open WebRTC data channels
  for (const [peerId, conn] of activeConnections.entries()) {
    if (conn.open) {
      try {
        conn.send(packet);
        sentCount++;
        console.log(`[P2PEngine] SOS signal transmitted to peer: ${peerId}`);
      } catch (err) {
        console.warn(`[P2PEngine] Failed sending SOS to peer ${peerId}:`, err);
      }
    }
  }

  // Fallback: If no connected P2P peers or device offline, persist to LocalStorage queue
  const isOfflineOrIsolated = sentCount === 0 || (typeof navigator !== 'undefined' && !navigator.onLine);

  if (isOfflineOrIsolated) {
    console.log('[P2PEngine] Fallback active: Saving emergency SOS payload to LocalStorage offline queue.');
    saveToOfflineQueue(QUEUE_ITEM_TYPES.SOS_ALERT, sosPayload);
  }

  // Self-notify local UI subscribers
  notifyMessageListeners(packet, localPeerId);

  return {
    sentCount,
    queuedOffline: isOfflineOrIsolated,
    packet
  };
}

/**
 * Broadcasts a text message for local mesh chat updates to all connected peers.
 * 
 * @param {string} textMessage - Text message content
 * @param {Object} [extraData] - Additional metadata (e.g. senderName, location)
 * @returns {{ sentCount: number, packet: Object }}
 */
export function broadcastMessage(textMessage, extraData = {}) {
  const packet = {
    id: `p2p_chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'CHAT_MESSAGE',
    senderId: localPeerId || 'local-device',
    timestamp: new Date().toISOString(),
    payload: {
      text: textMessage,
      ...extraData
    }
  };

  let sentCount = 0;

  for (const [peerId, conn] of activeConnections.entries()) {
    if (conn.open) {
      try {
        conn.send(packet);
        sentCount++;
      } catch (err) {
        console.warn(`[P2PEngine] Failed sending chat message to peer ${peerId}:`, err);
      }
    }
  }

  // Notify local UI subscribers
  notifyMessageListeners(packet, localPeerId);

  return {
    sentCount,
    packet
  };
}

// ============================================================================
// 3. EVENT LISTENER SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribes a callback to receive incoming dynamic P2P messages (SOS alerts, mesh chat, etc.).
 * 
 * @param {Function} callback (packet, senderId) => void
 * @returns {Function} Unsubscribe function
 */
export function onPeerMessage(callback) {
  if (typeof callback === 'function') {
    messageListeners.add(callback);
  }
  return () => {
    messageListeners.delete(callback);
  };
}

/**
 * Subscribes a callback to be notified when a new P2P WebRTC data connection opens.
 * 
 * @param {Function} callback (peerId, dataConnection) => void
 * @returns {Function} Unsubscribe function
 */
export function onPeerConnected(callback) {
  if (typeof callback === 'function') {
    connectionListeners.add(callback);
  }
  return () => {
    connectionListeners.delete(callback);
  };
}

/**
 * Subscribes a callback to be notified when a P2P connection closes.
 * 
 * @param {Function} callback (peerId) => void
 * @returns {Function} Unsubscribe function
 */
export function onPeerDisconnected(callback) {
  if (typeof callback === 'function') {
    disconnectionListeners.add(callback);
  }
  return () => {
    disconnectionListeners.delete(callback);
  };
}

/**
 * Subscribes a callback to receive P2P engine status changes ('connecting', 'connected', 'offline_fallback', 'error').
 * 
 * @param {Function} callback (status, metadata) => void
 * @returns {Function} Unsubscribe function
 */
export function onStatusChange(callback) {
  if (typeof callback === 'function') {
    statusListeners.add(callback);
  }
  return () => {
    statusListeners.delete(callback);
  };
}

// ============================================================================
// 4. GETTERS & DISCONNECT UTILITIES
// ============================================================================

/**
 * Returns the current local Peer ID.
 * 
 * @returns {string|null}
 */
export function getPeerId() {
  return localPeerId;
}

/**
 * Returns a list of active connected Peer IDs.
 * 
 * @returns {Array<string>}
 */
export function getConnectedPeers() {
  return Array.from(activeConnections.keys());
}

/**
 * Returns current P2P engine status.
 * 
 * @returns {string}
 */
export function getEngineStatus() {
  return engineStatus;
}

/**
 * Gracefully closes all active connections and destroys local peer node.
 */
export function disconnectP2P() {
  activeConnections.forEach((conn) => {
    try {
      conn.close();
    } catch {
      // Ignore
    }
  });
  activeConnections.clear();

  if (localPeer && !localPeer.destroyed) {
    try {
      localPeer.destroy();
    } catch {
      // Ignore
    }
  }

  localPeer = null;
  localPeerId = null;
  updateStatus('disconnected');
}

export default {
  initP2PEngine,
  connectToPeer,
  broadcastSOS,
  broadcastMessage,
  onPeerMessage,
  onPeerConnected,
  onPeerDisconnected,
  onStatusChange,
  getPeerId,
  getConnectedPeers,
  getEngineStatus,
  getBatteryLevel,
  disconnectP2P
};
