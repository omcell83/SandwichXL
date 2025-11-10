(function (global) {
    const STORAGE_KEY = 'sandwichXL_ordersState';
    const STATS_KEY = 'sandwichXL_statsState';
    const DOWNLOAD_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const CHANNEL_NAME = 'sandwichXL_ordersChannel';
    const ORDER_EVENT = 'sandwichXL:ordersChanged';

    const listeners = new Set();
    let downloadUrls = { orders: null, stats: null };
    let state = { active: [], completed: [] };
    let stats = [];
    let initPromise = null;

    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

    function safeClone(value) {
        try {
            return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
        } catch (error) {
            return JSON.parse(JSON.stringify(value));
        }
    }

    function normaliseStatus(value, fallback = 'Active') {
        const raw = (value || fallback || '').toString().toLowerCase();
        return raw === 'completed' ? 'Completed' : 'Active';
    }

    function formatDate(value) {
        if (!value) {
            return new Date().toISOString().split('T')[0];
        }
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return new Date().toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
    }

    function resolveLanguage(value) {
        if (!value) {
            return { code: 'other', label: 'Diğer' };
        }
        const raw = value.toString().toLowerCase();
        const map = {
            'tr': { code: 'tr', label: 'Türkçe' },
            'tr-tr': { code: 'tr', label: 'Türkçe' },
            'türkçe': { code: 'tr', label: 'Türkçe' },
            'en': { code: 'en', label: 'English' },
            'en-us': { code: 'en', label: 'English' },
            'en-gb': { code: 'en', label: 'English' },
            'english': { code: 'en', label: 'English' },
            'de': { code: 'de', label: 'Deutsch' },
            'de-de': { code: 'de', label: 'Deutsch' },
            'deutsch': { code: 'de', label: 'Deutsch' },
            'fr': { code: 'fr', label: 'Français' },
            'fr-fr': { code: 'fr', label: 'Français' },
            'français': { code: 'fr', label: 'Français' }
        };
        return map[raw] || { code: raw.slice(0, 2) || 'other', label: value }; 
    }

    function normaliseOrder(order, fallbackStatus) {
        if (!order || typeof order !== 'object') {
            return null;
        }
        const langInfo = resolveLanguage(order.Language || order.language);
        const quantity = Number(order.Quantity ?? order.quantity ?? 0) || 0;
        const total = Number(order.Total ?? order.total ?? 0) || 0;

        return {
            OrderID: order.OrderID || order.orderId || generateOrderId(),
            Date: formatDate(order.Date || order.date),
            Status: normaliseStatus(order.Status || order.status, fallbackStatus),
            ProductID: order.ProductID || order.productId || '',
            ProductName: order.ProductName || order.productName || '',
            Quantity: quantity,
            Total: Number(total.toFixed ? total : Number(total.toFixed(2))) || total,
            Language: langInfo.label,
            LanguageCode: langInfo.code,
            AddOn: order.AddOn || order.addOn || '',
            Note: order.Note || order.note || ''
        };
    }

    function normaliseState(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const active = Array.isArray(source.active) ? source.active.map((item) => normaliseOrder(item, 'Active')).filter(Boolean) : [];
        const completed = Array.isArray(source.completed) ? source.completed.map((item) => normaliseOrder(item, 'Completed')).filter(Boolean) : [];
        return { active, completed };
    }

    function normaliseStat(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const langInfo = resolveLanguage(item.Language || item.language);
        const ordersCount = Number(item.Orders ?? item.orders ?? 0) || 0;
        const itemsPerPerson = Number(item.ItemsPerPerson ?? item.itemsPerPerson ?? 0) || 0;
        const averageValue = Number(item.AverageOrderValue ?? item.averageOrderValue ?? 0) || 0;
        const complementaryRate = Number(item.ComplementaryRate ?? item.complementaryRate ?? 0) || 0;
        return {
            Language: langInfo.label,
            LanguageCode: langInfo.code,
            Orders: ordersCount,
            ItemsPerPerson: Number(itemsPerPerson.toFixed ? itemsPerPerson : Number(itemsPerPerson.toFixed(1))) || itemsPerPerson,
            AverageOrderValue: Number(averageValue.toFixed ? averageValue : Number(averageValue.toFixed(2))) || averageValue,
            ComplementaryRate: Math.round(complementaryRate)
        };
    }

    function normaliseStats(raw) {
        const list = Array.isArray(raw) ? raw : [];
        return list.map(normaliseStat).filter(Boolean);
    }

    function loadFromStorage(key) {
        try {
            const raw = global.localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (error) {
            console.warn('Veri okunamadı:', key, error);
            return null;
        }
    }

    function persistToStorage(key, value) {
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('Veri kaydedilemedi:', key, error);
        }
    }

    function getAllOrders() {
        return [...state.active, ...state.completed];
    }

    function generateOrderId() {
        const dateStamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const existing = new Set(getAllOrders().map((order) => order.OrderID));
        let counter = existing.size + 1;
        let candidate = `SX-${dateStamp}-${String(counter).padStart(3, '0')}`;
        while (existing.has(candidate)) {
            counter += 1;
            candidate = `SX-${dateStamp}-${String(counter).padStart(3, '0')}`;
        }
        return candidate;
    }

    function recomputeStats() {
        const aggregates = new Map();
        const allOrders = getAllOrders();
        allOrders.forEach((order) => {
            const key = order.LanguageCode || resolveLanguage(order.Language).code;
            if (!aggregates.has(key)) {
                aggregates.set(key, {
                    Language: order.Language,
                    LanguageCode: key,
                    Orders: 0,
                    Items: 0,
                    TotalValue: 0,
                    WithAddOn: 0
                });
            }
            const bucket = aggregates.get(key);
            bucket.Language = order.Language;
            bucket.Orders += 1;
            bucket.Items += Number(order.Quantity) || 0;
            bucket.TotalValue += Number(order.Total) || 0;
            if (order.AddOn && order.AddOn.toString().trim().length > 0) {
                bucket.WithAddOn += 1;
            }
        });

        const nextStats = Array.from(aggregates.values()).map((bucket) => {
            const itemsPerPerson = bucket.Orders > 0 ? bucket.Items / bucket.Orders : 0;
            const averageValue = bucket.Orders > 0 ? bucket.TotalValue / bucket.Orders : 0;
            const complementaryRate = bucket.Orders > 0 ? Math.round((bucket.WithAddOn / bucket.Orders) * 100) : 0;
            return {
                Language: bucket.Language,
                LanguageCode: bucket.LanguageCode,
                Orders: bucket.Orders,
                ItemsPerPerson: Number(itemsPerPerson.toFixed(1)),
                AverageOrderValue: Number(averageValue.toFixed(2)),
                ComplementaryRate: complementaryRate
            };
        });

        stats = nextStats;
        persistToStorage(STATS_KEY, stats);
        return stats;
    }

    function updateDownloadUrls() {
        if (!global.XLSX) {
            return;
        }
        if (downloadUrls.orders) {
            global.URL.revokeObjectURL(downloadUrls.orders);
        }
        if (downloadUrls.stats) {
            global.URL.revokeObjectURL(downloadUrls.stats);
        }

        const ordersSheetData = getAllOrders().map((order) => ({
            OrderID: order.OrderID,
            Date: order.Date,
            Status: order.Status,
            ProductID: order.ProductID,
            ProductName: order.ProductName,
            Quantity: order.Quantity,
            Total: order.Total,
            Language: order.Language,
            AddOn: order.AddOn,
            Note: order.Note
        }));
        const ordersSheet = global.XLSX.utils.json_to_sheet(ordersSheetData);
        const ordersBook = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(ordersBook, ordersSheet, 'Orders');
        const ordersArray = global.XLSX.write(ordersBook, { bookType: 'xlsx', type: 'array' });
        downloadUrls.orders = global.URL.createObjectURL(new Blob([ordersArray], { type: DOWNLOAD_MIME }));

        const statsSheetData = stats.map((item) => ({
            Language: item.Language,
            Orders: item.Orders,
            ItemsPerPerson: item.ItemsPerPerson,
            AverageOrderValue: item.AverageOrderValue,
            ComplementaryRate: item.ComplementaryRate
        }));
        const statsSheet = global.XLSX.utils.json_to_sheet(statsSheetData);
        const statsBook = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(statsBook, statsSheet, 'Stats');
        const statsArray = global.XLSX.write(statsBook, { bookType: 'xlsx', type: 'array' });
        downloadUrls.stats = global.URL.createObjectURL(new Blob([statsArray], { type: DOWNLOAD_MIME }));
    }

    function broadcast() {
        const snapshot = getSnapshot();
        listeners.forEach((listener) => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error('Sipariş dinleyicisinde hata oluştu.', error);
            }
        });
        if (channel) {
            try {
                channel.postMessage(snapshot);
            } catch (error) {
                console.warn('Sipariş kanalı mesajı gönderilemedi.', error);
            }
        }
        const event = new CustomEvent(ORDER_EVENT, { detail: snapshot });
        global.dispatchEvent(event);
    }

    function persistState(triggerBroadcast = false) {
        persistToStorage(STORAGE_KEY, state);
        if (triggerBroadcast) {
            broadcast();
        }
    }

    function persistStats(triggerBroadcast = false) {
        persistToStorage(STATS_KEY, stats);
        if (triggerBroadcast) {
            broadcast();
        }
    }

    function applySnapshot(snapshot, options = {}) {
        if (!snapshot || typeof snapshot !== 'object') {
            return;
        }
        const nextState = snapshot.orders ? snapshot.orders : snapshot;
        state = normaliseState(nextState);
        stats = normaliseStats(snapshot.stats || stats);
        persistState(false);
        persistStats(false);
        recomputeStats();
        updateDownloadUrls();
        if (!options.silent) {
            broadcast();
        }
    }

    async function readInitialOrders() {
        if (!global.XLSX) {
            return { active: [], completed: [] };
        }
        try {
            const response = await fetch('data/orders.xlsx');
            const arrayBuffer = await response.arrayBuffer();
            const workbook = global.XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = global.XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const initial = { active: [], completed: [] };
            rows.forEach((row) => {
                const normalised = normaliseOrder(row, row.Status);
                if (!normalised) {
                    return;
                }
                if (normalised.Status === 'Completed') {
                    initial.completed.push(normalised);
                } else {
                    initial.active.push(normalised);
                }
            });
            return initial;
        } catch (error) {
            console.warn('Varsayılan sipariş dosyası yüklenemedi.', error);
            return { active: [], completed: [] };
        }
    }

    async function readInitialStats() {
        if (!global.XLSX) {
            return [];
        }
        try {
            const response = await fetch('data/user_stats.xlsx');
            const arrayBuffer = await response.arrayBuffer();
            const workbook = global.XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = global.XLSX.utils.sheet_to_json(sheet, { defval: '' });
            return normaliseStats(rows);
        } catch (error) {
            console.warn('Varsayılan istatistik dosyası yüklenemedi.', error);
            return [];
        }
    }

    async function init() {
        if (initPromise) {
            return initPromise;
        }
        initPromise = (async () => {
            const storedState = loadFromStorage(STORAGE_KEY);
            const storedStats = loadFromStorage(STATS_KEY);
            if (storedState) {
                state = normaliseState(storedState);
            } else {
                state = await readInitialOrders();
                persistState(false);
            }
            if (storedStats) {
                stats = normaliseStats(storedStats);
            } else {
                stats = await readInitialStats();
                if (stats.length === 0) {
                    stats = recomputeStats();
                } else {
                    persistStats(false);
                }
            }
            recomputeStats();
            updateDownloadUrls();
            broadcast();
            return getSnapshot();
        })();
        return initPromise;
    }

    function getSnapshot() {
        return {
            orders: safeClone(state),
            stats: safeClone(stats)
        };
    }

    function getOrders() {
        return safeClone(state);
    }

    function getStats() {
        return safeClone(stats);
    }

    function getDownloadUrl(type) {
        if (type === 'stats') {
            return downloadUrls.stats;
        }
        return downloadUrls.orders;
    }

    function addOrder(order) {
        const normalised = normaliseOrder(order, 'Active');
        if (!normalised) {
            return null;
        }
        if (!order.OrderID && !order.orderId) {
            normalised.OrderID = generateOrderId();
        }
        state.active.unshift(normalised);
        persistState(false);
        recomputeStats();
        persistStats(false);
        updateDownloadUrls();
        broadcast();
        return normalised;
    }

    function updateOrderStatus(orderId, status) {
        if (!orderId) {
            return null;
        }
        const formatted = normaliseStatus(status);
        let target = null;
        state.active = state.active.filter((order) => {
            if (order.OrderID === orderId) {
                target = order;
                return false;
            }
            return true;
        });
        if (!target) {
            state.completed = state.completed.filter((order) => {
                if (order.OrderID === orderId) {
                    target = order;
                    return false;
                }
                return true;
            });
        }
        if (!target) {
            return null;
        }
        target.Status = formatted;
        if (formatted === 'Completed') {
            state.completed.unshift(target);
        } else {
            state.active.unshift(target);
        }
        persistState(false);
        recomputeStats();
        persistStats(false);
        updateDownloadUrls();
        broadcast();
        return target;
    }

    function completeOrder(orderId) {
        return updateOrderStatus(orderId, 'Completed');
    }

    function removeOrder(orderId) {
        if (!orderId) return null;
        let removed = null;
        state.active = state.active.filter((order) => {
            if (order.OrderID === orderId) {
                removed = order;
                return false;
            }
            return true;
        });
        if (!removed) {
            state.completed = state.completed.filter((order) => {
                if (order.OrderID === orderId) {
                    removed = order;
                    return false;
                }
                return true;
            });
        }
        if (removed) {
            persistState(false);
            recomputeStats();
            persistStats(false);
            updateDownloadUrls();
            broadcast();
        }
        return removed;
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function handleStorage(event) {
        if (event.key === STORAGE_KEY) {
            try {
                const parsed = JSON.parse(event.newValue);
                applySnapshot({ orders: parsed, stats }, { silent: false });
            } catch (error) {
                console.warn('Depolanan sipariş verisi çözümlenemedi.', error);
            }
        }
        if (event.key === STATS_KEY) {
            try {
                const parsedStats = JSON.parse(event.newValue);
                stats = normaliseStats(parsedStats);
                persistStats(false);
                updateDownloadUrls();
                broadcast();
            } catch (error) {
                console.warn('Depolanan istatistik verisi çözümlenemedi.', error);
            }
        }
    }

    function handleChannelMessage(event) {
        if (!event || !event.data) {
            return;
        }
        applySnapshot(event.data, { silent: true });
    }

    global.addEventListener('storage', handleStorage);
    if (channel) {
        channel.addEventListener('message', handleChannelMessage);
    }

    global.OrderDataStore = {
        init,
        getSnapshot,
        getOrders,
        getStats,
        getDownloadUrl,
        addOrder,
        updateOrderStatus,
        completeOrder,
        removeOrder,
        subscribe,
        generateOrderId
    };
})(window);
