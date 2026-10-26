import { CART_STORAGE_KEY, getStoredCart } from './cart-store';

export function getTabStateEvidence(tabAItems: any[], tabBItems: any[], isFixed: boolean) {
  const tabATotal = tabAItems.reduce((s, i) => s + i.priceMinor, 0);
  const tabBTotal = tabBItems.reduce((s, i) => s + i.priceMinor, 0);
  const storageTotal = getStoredCart().reduce((s, i) => s + i.priceMinor, 0);

  const logContent = [
    `Tab A UI total: ${tabATotal} minor units ($${(tabATotal/100).toFixed(2)}). In-memory items: ${tabAItems.length}.`,
    `Tab B UI total: ${tabBTotal} minor units ($${(tabBTotal/100).toFixed(2)}). In-memory items: ${tabBItems.length}.`,
    `Browser localStorage key "${CART_STORAGE_KEY}" total: ${storageTotal} minor units.`,
    isFixed
      ? `Synchronization status: FIXED (Tab B registers window 'storage' event listener and reflects changes immediately).`
      : `Synchronization status: BUGGY (Tab B does not register window 'storage' listener; retains stale in-memory state until manual refresh).`,
    `Refreshing Tab B changes its total to ${storageTotal} minor units.`
  ].join('\n');

  const sourceCode = `// React Cart Component State Flow
export function Cart() {
  const [items, setItems] = useState(() => JSON.parse(localStorage.getItem('cart') || '[]'));
  
  ${isFixed ? `// FIXED MODE: Listen to storage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cart' && e.newValue) {
        setItems(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);` : `// BUGGY MODE: Storage event listener is missing!
  // In-memory React state remains stale when another tab modifies localStorage.`}

  const addItem = (item) => {
    const next = [...items, item];
    setItems(next);
    localStorage.setItem('cart', JSON.stringify(next));
  };

  return <div>Total: {items.reduce((s, i) => s + i.price, 0)}</div>;
}`;

  return { logContent, sourceCode, tabATotal, tabBTotal, storageTotal };
}

export function getRequestDetectiveEvidence(requestId: string, status: number, isFixed: boolean) {
  const frontendLog = [
    `2026-10-26T10:30:15.200Z [ui.order] User clicked "Place Order" button.`,
    `2026-10-26T10:30:15.202Z [ui.order] Setting button state: isLoading = true, spinner active.`,
    `2026-10-26T10:30:15.210Z [api.order] Generated requestId = "${requestId}", dispatching POST /api/demo/order.`,
    `2026-10-26T10:30:15.310Z [api.order] Received HTTP ${status} error from /api/demo/order for requestId = "${requestId}".`,
    isFixed
      ? `2026-10-26T10:30:15.312Z [ui.order] FIXED: finally { isLoading = false; setErrorMessage("Order failed: Inventory unavailable"); }`
      : `2026-10-26T10:30:15.312Z [ui.order] BUGGY: Missing catch/finally cleanup! isLoading remains true indefinitely; spinner continues spinning.`
  ].join('\n');

  const harContent = JSON.stringify({
    log: {
      version: '1.2',
      creator: { name: 'StateGhost Demo Recorder', version: '1.0' },
      entries: [
        {
          startedDateTime: '2026-10-26T10:30:15.220Z',
          time: 90,
          request: {
            method: 'POST',
            url: 'http://127.0.0.1:3001/api/demo/order',
            headers: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'X-Request-ID', value: requestId },
              { name: 'Authorization', value: 'Bearer demo_secret_token_12345' }
            ],
            postData: {
              mimeType: 'application/json',
              text: JSON.stringify({ requestId })
            }
          },
          response: {
            status,
            statusText: 'Internal Server Error',
            headers: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'X-Request-ID', value: requestId }
            ],
            content: {
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Demo inventory service unavailable', requestId })
            }
          }
        }
      ]
    }
  }, null, 2);

  return { frontendLog, harContent };
}
