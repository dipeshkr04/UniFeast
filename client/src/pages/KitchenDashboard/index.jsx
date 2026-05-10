import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import KitchenSidebar from './KitchenSidebar';
import KitchenStatusNav from './KitchenStatusNav';
import OrderGrid from './OrderGrid';
import OrderCard from './OrderCard';
import KitchenSocketProvider from './KitchenSocketProvider';
import { useKitchenOrders } from './useKitchenOrders';
import { orderAPI } from '../../api';
import { HiOutlineSearch, HiX } from 'react-icons/hi';
import { MdQrCodeScanner } from 'react-icons/md';
import jsQR from 'jsqr';
import './KitchenDashboard.css';

const QRScannerModal = ({ open, onClose, onStatusUpdate, onItemReady }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLockRef = useRef(false);
  const canvasRef = useRef(null);
  const [manualCode, setManualCode] = useState('');
  const [scanState, setScanState] = useState('idle');
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetScanner = useCallback(() => {
    stopCamera();
    setManualCode('');
    setScanState('idle');
    setScanError('');
    setScanResult(null);
    scanLockRef.current = false;
  }, [stopCamera]);

  const closeScanner = () => {
    resetScanner();
    onClose();
  };

  const handleScanPayload = useCallback(async (payload) => {
    const qrPayload = String(payload || '').trim();
    if (!qrPayload) return;

    scanLockRef.current = true;
    setScanState('checking');
    setScanError('');
    try {
      const { data } = await orderAPI.scanQr(qrPayload);
      setScanResult(data.data);
      setScanState('matched');
      stopCamera();
    } catch (err) {
      setScanResult(null);
      setScanError(err.response?.data?.message || 'No active order found for this QR');
      setScanState('error');
      setTimeout(() => {
        scanLockRef.current = false;
        setScanState('scanning');
      }, 1400);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open || scanResult) return undefined;
    let cancelled = false;
    let frameId = null;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanState('manual');
        setScanError('Camera access is not available in this browser. Paste the QR text below.');
        return;
      }

      try {
        setScanState('requesting');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks?.().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setScanState('scanning');
        setScanError('');
        const canvas = canvasRef.current || document.createElement('canvas');
        canvasRef.current = canvas;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        let lastHintAt = 0;

        const readQrFromVideo = () => {
          const video = videoRef.current;
          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            return '';
          }

          if (!context || !video.videoWidth || !video.videoHeight) {
            return '';
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          return code?.data || '';
        };

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const value = readQrFromVideo();
            if (value && !scanLockRef.current) {
              await handleScanPayload(value);
              return;
            }
            const now = Date.now();
            if (!scanLockRef.current && now - lastHintAt > 5000) {
              lastHintAt = now;
              setScanError('Camera is active. Hold the QR steady inside the frame if it has not matched yet.');
            }
          } catch (err) {
            setScanError(err?.message || 'Scanner had trouble reading this frame. Keep the QR steady.');
          }
          frameId = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        setScanState('manual');
        const errorName = err?.name;
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          setScanError('Camera permission is blocked. Allow camera access in the browser, or paste the QR text below.');
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setScanError('No camera was found on this device. Paste the QR text below.');
        } else {
          setScanError('Unable to start the camera. Paste the QR text below.');
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      stopCamera();
      scanLockRef.current = false;
    };
  }, [open, scanResult, handleScanPayload, stopCamera]);

  if (!open) return null;

  const updateScannedStatus = async (orderId, nextStatus) => {
    const success = await onStatusUpdate(orderId, nextStatus);
    if (!success) return;
    const status = String(nextStatus || '').toLowerCase();
    setScanResult((prev) => {
      if (!prev) return prev;
      const orders = status === 'completed'
        ? prev.orders.filter((order) => order._id !== orderId)
        : prev.orders.map((order) => order._id === orderId ? { ...order, status } : order);
      return { ...prev, orders };
    });
  };

  const updateScannedItemReady = async (orderId, itemId) => {
    const updatedOrder = await onItemReady(orderId, itemId);
    if (!updatedOrder) return;
    setScanResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        orders: prev.orders.map((order) => (
          order._id === orderId && updatedOrder?._id ? updatedOrder : order
        )),
      };
    });
  };

  return (
    <div className="qr-scanner-backdrop" onClick={closeScanner}>
      <div className="qr-scanner-modal" onClick={(event) => event.stopPropagation()}>
        <div className="qr-scanner-header">
          <div>
            <span className="qr-scanner-eyebrow">Pickup verification</span>
            <h2>Scan Student QR</h2>
            <p>Only active orders are shown. Completed orders cannot be reused.</p>
          </div>
          <button className="qr-scanner-close" onClick={closeScanner} aria-label="Close scanner">
            <HiX />
          </button>
        </div>

        {!scanResult && (
          <>
            <div className="qr-camera-box">
              <video ref={videoRef} muted playsInline />
              <div className="qr-camera-frame" />
              <span>{scanState === 'checking' ? 'Checking QR...' : 'Align QR inside the frame'}</span>
            </div>
            {scanError && <div className="qr-scan-error">{scanError}</div>}
            <div className="qr-manual-entry">
              <input
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Paste QR text if camera cannot scan"
                aria-label="Paste QR text"
              />
              <button onClick={() => handleScanPayload(manualCode)} disabled={!manualCode.trim() || scanState === 'checking'}>
                Verify
              </button>
            </div>
          </>
        )}

        {scanResult && (
          <div className="qr-scan-results">
            <div className="qr-scan-match">
              <span>Matched</span>
              <strong>{scanResult.user?.btId || scanResult.user?.name || 'Student'}</strong>
              <small>{scanResult.orders.length} active order{scanResult.orders.length === 1 ? '' : 's'}</small>
            </div>
            {scanResult.orders.length === 0 ? (
              <div className="qr-scan-empty">No active orders left for this QR.</div>
            ) : (
              <div className="qr-scanner-card-list">
                {scanResult.orders.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onStatusUpdate={updateScannedStatus}
                    onItemReady={updateScannedItemReady}
                  />
                ))}
              </div>
            )}
            <button
              className="qr-scan-again"
              onClick={() => {
                setScanResult(null);
                setScanError('');
                setManualCode('');
                scanLockRef.current = false;
              }}
            >
              Scan another QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const KitchenDashboardContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { canteenLive } = useOutletContext() || {};
  
  const {
    filteredOrders,
    orders,
    activeFilter,
    setActiveFilter,
    dishFilter,
    setDishFilter,
    searchQuery,
    setSearchQuery,
    dishOptions,
    selectedDish,
    summary,
    isConnected,
    isOverloaded,
    reconnecting,
    updateOrderStatus,
    markItemReady
  } = useKitchenOrders();

  return (
    <div className="kitchen-page">
      <div 
        className={`kitchen-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <KitchenSidebar
        summary={summary}
        orders={orders}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        queueStats={summary.queueStats}
        isOverloaded={isOverloaded}
        isConnected={isConnected}
      />
      
      <div className="kitchen-main">
        <KitchenStatusNav
          summary={summary}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          canteenLive={canteenLive}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        
        {reconnecting && (
          <div className="kitchen-reconnect-banner">
            Reconnecting... live updates are paused
          </div>
        )}

        <div className="dish-filter-panel">
          <div className="dish-filter-copy">
            <span className="dish-filter-eyebrow">Dish filter</span>
            <strong>{selectedDish ? selectedDish.name : 'All dishes'}</strong>
            <small>
              {selectedDish
                ? `${selectedDish.orderCount} order${selectedDish.orderCount === 1 ? '' : 's'} / ${selectedDish.quantity} item${selectedDish.quantity === 1 ? '' : 's'} today`
                : 'Pick an item to show only matching live order cards'}
            </small>
          </div>

          <div className="dish-filter-tools">
            <div className="kitchen-order-search">
              <HiOutlineSearch className="kitchen-order-search-icon" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search BT ID, name, token..."
                aria-label="Search live orders by BT ID, student name, or order token"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <HiX />
                </button>
              )}
            </div>

            <div className="dish-filter-controls">
              <select
                value={dishFilter}
                onChange={(event) => setDishFilter(event.target.value)}
                className="dish-filter-select"
                aria-label="Filter kitchen orders by dish"
              >
                <option value="ALL">All dishes</option>
                {dishOptions.map((dish) => (
                  <option key={dish.key} value={dish.key}>
                    {dish.name} ({dish.orderCount} orders / {dish.quantity} qty)
                  </option>
                ))}
              </select>
              {dishFilter !== 'ALL' && (
                <button className="dish-filter-clear" onClick={() => setDishFilter('ALL')}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="kitchen-orders-area">
          <OrderGrid
            orders={filteredOrders}
            activeFilter={activeFilter}
            dishFilterLabel={selectedDish?.name}
            dishFilterKey={dishFilter}
            onStatusUpdate={updateOrderStatus}
            onItemReady={markItemReady}
          />
        </div>
      </div>
      <button className="kitchen-qr-fab" onClick={() => setScannerOpen(true)} aria-label="Open QR scanner">
        <MdQrCodeScanner />
      </button>
      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onStatusUpdate={updateOrderStatus}
        onItemReady={markItemReady}
      />
    </div>
  );
};

const KitchenDashboard = () => {
  return (
    <KitchenSocketProvider>
      <KitchenDashboardContent />
    </KitchenSocketProvider>
  );
};

export default KitchenDashboard;
