(function (global) {
    const STORAGE_KEY = 'sandwichXL_ordersState';
    const STATS_KEY = 'sandwichXL_statsState';
    const DOWNLOAD_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const CHANNEL_NAME = 'sandwichXL_ordersChannel';
    const ORDER_EVENT = 'sandwichXL:ordersChanged';

    const listeners = new Set();
    let state = { active: [], archive: [] };
    let stats = [];
    let downloadUrls = { orders: null, stats: null };
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
        if (raw === 'completed') {
            return 'Completed';
        }
        if (raw === 'cancelled' || raw === 'canceled') {
            return 'Cancelled';
        }
        return 'Active';
    }

    function toISODateTime(value) {
        if (!value) {
            return new Date().toISOString();
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return new Date().toISOString();
        }
        return parsed.toISOString();
    }

    function formatDate(value) {
        if (!value) {
            return new Date().toISOString().split('T')[0];
        }
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        if (typeof value === 'string' && value.includes('T')) {
            return value.split('T')[0];
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return new Date().toISOString().split('T')[0];
        }
        return parsed.toISOString().split('T')[0];
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

    function composeOrderId(counterDate, number) {
        const datePart = formatDate(counterDate).replace(/-/g, '');
        return `${datePart}-${String(number).padStart(3, '0')}`;
    }

    function extractOrderNumber(orderId) {
        if (!orderId) {
            return null;
        }
        const match = orderId.toString().match(/(\d{3,})$/);
        if (!match) {
            return null;
        }
        return Number(match[1]);
    }

    function normaliseItem(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const quantityRaw = Number(item.Quantity ?? item.quantity ?? 0);
        const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
        const unitPriceRaw = Number(item.UnitPrice ?? item.unitPrice ?? item.price ?? 0);
        const unitPrice = Number.isFinite(unitPriceRaw) ? Number(unitPriceRaw.toFixed(2)) : 0;
        const totalRaw = Number(item.Total ?? item.total ?? unitPrice * quantity);
        const total = Number.isFinite(totalRaw) ? Number(totalRaw.toFixed(2)) : Number((unitPrice * quantity).toFixed(2));
        return {
            id: item.ProductID || item.productId || item.id || '',
            name: item.ProductName || item.productName || item.name || '',
            quantity,
            unitPrice,
            total,
            size: item.Size || item.size || '',
            isAddOn: Boolean(item.AddOn || item.addOn || item.isAddOn)
        };
    }

    function normaliseOrder(order, fallbackStatus, options = {}) {
        if (!order || typeof order !== 'object') {
            return null;
        }
        const allowGenerate = options.allowGenerate !== false;
        const langInfo = resolveLanguage(order.Language || order.language);
        const createdAt = toISODateTime(order.CreatedAt || order.createdAt || order.Date || order.date);
        let counterDate = formatDate(order.CounterDate || order.counterDate || createdAt);
        let orderId = order.OrderID || order.orderId || '';
        let orderNumber = Number(order.OrderNumber ?? order.orderNumber);
        if (!Number.isFinite(orderNumber)) {
            orderNumber = extractOrderNumber(orderId);
        }
        if (!orderId) {
            if (!allowGenerate) {
                return null;
            }
            const sequence = nextSequential(counterDate);
            orderId = sequence.id;
            orderNumber = sequence.number;
            counterDate = sequence.date;
        }
        if (!Number.isFinite(orderNumber)) {
            orderNumber = extractOrderNumber(orderId);
        }

        const rawItems = Array.isArray(order.Items) ? order.Items : Array.isArray(order.items) ? order.items : [];
        const items = rawItems.map(normaliseItem).filter(Boolean);
        const totalFromItems = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const totalRaw = Number(order.Total ?? order.total ?? totalFromItems);
        const total = Number.isFinite(totalRaw) ? Number(totalRaw.toFixed(2)) : Number(totalFromItems.toFixed(2));
        const status = normaliseStatus(order.Status || order.status, fallbackStatus);
        const note = (order.Note ?? order.note ?? '').toString().trim();

        return {
            OrderID: orderId,
            OrderNumber: Number.isFinite(orderNumber) ? orderNumber : null,
            CounterDate: counterDate,
            Date: formatDate(order.Date || order.date || counterDate),
            CreatedAt: createdAt,
            Status: status,
            Language: langInfo.label,
            LanguageCode: langInfo.code,
            Total: total,
            Items: items,
            Note: note,
            HasAddOn: items.some((item) => item.isAddOn)
        };
    }

    function normaliseState(raw) {
        if (!raw || typeof raw !== 'object') {
            return { active: [], archive: [] };
        }
        const activeSource = raw.active || raw.Active || [];
        const archiveSource = raw.archive || raw.history || raw.completed || [];
        const active = Array.isArray(activeSource)
            ? activeSource.map((item) => normaliseOrder(item, 'Active', { allowGenerate: false })).filter(Boolean)
            : [];
        const archive = Array.isArray(archiveSource)
            ? archiveSource.map((item) => normaliseOrder(item, 'Completed', { allowGenerate: false })).filter(Boolean)
            : [];
        return { active, archive };
    }

    function normaliseStat(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const langInfo = resolveLanguage(item.Language || item.language);
        const ordersCount = Number(item.Orders ?? item.orders ?? 0) || 0;
        const totalValue = Number(item.TotalValue ?? item.totalValue ?? 0) || 0;
        const averageValue = Number(item.AverageOrderValue ?? item.averageOrderValue ?? (ordersCount > 0 ? totalValue / ordersCount : 0));
        const complementaryRate = Number(item.ComplementaryRate ?? item.complementaryRate ?? 0) || 0;
        return {
            Language: langInfo.label,
            LanguageCode: langInfo.code,
            Orders: ordersCount,
            TotalValue: Number(totalValue.toFixed ? totalValue.toFixed(2) : totalValue),
            AverageOrderValue: Number(averageValue.toFixed ? averageValue.toFixed(2) : averageValue),
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
        return [...state.active, ...state.archive];
    }

    function nextSequential(counterDate) {
        const date = formatDate(counterDate);
        const existing = getAllOrders().filter((order) => order.CounterDate === date);
        const highest = existing.reduce((max, order) => {
            const num = Number(order.OrderNumber);
            return Number.isFinite(num) && num > max ? num : max;
        }, 0);
        const nextNumber = highest + 1;
        return { id: composeOrderId(date, nextNumber), number: nextNumber, date };
    }

    function generateOrderId(counterDate) {
        return nextSequential(counterDate).id;
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
                    TotalValue: 0,
                    WithAddOn: 0
                });
            }
            const bucket = aggregates.get(key);
            bucket.Language = order.Language;
            bucket.Orders += 1;
            bucket.TotalValue += Number(order.Total) || 0;
            if (order.HasAddOn) {
                bucket.WithAddOn += 1;
            }
        });

        stats = Array.from(aggregates.values()).map((bucket) => {
            const averageValue = bucket.Orders > 0 ? bucket.TotalValue / bucket.Orders : 0;
            const complementaryRate = bucket.Orders > 0 ? Math.round((bucket.WithAddOn / bucket.Orders) * 100) : 0;
            return {
                Language: bucket.Language,
                LanguageCode: bucket.LanguageCode,
                Orders: bucket.Orders,
                TotalValue: Number(bucket.TotalValue.toFixed(2)),
                AverageOrderValue: Number(averageValue.toFixed(2)),
                ComplementaryRate: complementaryRate
            };
        });

        persistToStorage(STATS_KEY, stats);
        return stats;
    }

    function createOrdersWorkbook() {
        if (!global.XLSX) {
            return null;
        }
        const workbook = global.XLSX.utils.book_new();
        const summaryRows = getAllOrders().map((order) => ({
            OrderID: order.OrderID,
            OrderNumber: order.OrderNumber,
            CounterDate: order.CounterDate,
            Date: order.Date,
            Status: order.Status,
            Language: order.Language,
            Total: order.Total,
            Note: order.Note,
            HasAddOn: order.HasAddOn ? 'Evet' : 'Hayır'
        }));
        const itemsRows = [];
        getAllOrders().forEach((order) => {
            (order.Items || []).forEach((item, index) => {
                itemsRows.push({
                    OrderID: order.OrderID,
                    Line: index + 1,
                    ProductID: item.id,
                    ProductName: item.name,
                    Size: item.size,
                    Quantity: item.quantity,
                    UnitPrice: item.unitPrice,
                    LineTotal: item.total,
                    AddOn: item.isAddOn ? 'Evet' : 'Hayır'
                });
            });
        });
        const summarySheet = global.XLSX.utils.json_to_sheet(summaryRows);
        const itemsSheet = global.XLSX.utils.json_to_sheet(itemsRows);
        global.XLSX.utils.book_append_sheet(workbook, summarySheet, 'Orders');
        global.XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
        return workbook;
    }

    function createStatsWorkbook() {
        if (!global.XLSX) {
            return null;
        }
        const workbook = global.XLSX.utils.book_new();
        const statsSheet = global.XLSX.utils.json_to_sheet(stats.map((item) => ({
            Language: item.Language,
            Orders: item.Orders,
            TotalValue: item.TotalValue,
            AverageOrderValue: item.AverageOrderValue,
            ComplementaryRate: item.ComplementaryRate
        })));
        global.XLSX.utils.book_append_sheet(workbook, statsSheet, 'Stats');
        return workbook;
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

        const ordersBook = createOrdersWorkbook();
        if (ordersBook) {
            const ordersArray = global.XLSX.write(ordersBook, { bookType: 'xlsx', type: 'array' });
            downloadUrls.orders = global.URL.createObjectURL(new Blob([ordersArray], { type: DOWNLOAD_MIME }));
        } else {
            downloadUrls.orders = null;
        }

        const statsBook = createStatsWorkbook();
        if (statsBook) {
            const statsArray = global.XLSX.write(statsBook, { bookType: 'xlsx', type: 'array' });
            downloadUrls.stats = global.URL.createObjectURL(new Blob([statsArray], { type: DOWNLOAD_MIME }));
        } else {
            downloadUrls.stats = null;
        }
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
        const nextOrders = snapshot.orders ? snapshot.orders : snapshot;
        const nextState = normaliseState(nextOrders);
        state = nextState;
        stats = normaliseStats(snapshot.stats || stats);
        persistState(false);
        recomputeStats();
        persistStats(false);
        updateDownloadUrls();
        if (!options.silent) {
            broadcast();
        }
    }

    async function readInitialOrders() {
        if (!global.XLSX) {
            return { active: [], archive: [] };
        }
        try {
            const response = await fetch('data/orders.xlsx');
            const arrayBuffer = await response.arrayBuffer();
            const workbook = global.XLSX.read(arrayBuffer, { type: 'array' });
            const sheetNames = workbook.SheetNames || [];
            let summaryRows = [];
            let itemRows = [];
            if (sheetNames.includes('Orders')) {
                summaryRows = global.XLSX.utils.sheet_to_json(workbook.Sheets['Orders'], { defval: '' });
            } else if (sheetNames.length > 0) {
                summaryRows = global.XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]], { defval: '' });
            }
            if (sheetNames.includes('Items')) {
                itemRows = global.XLSX.utils.sheet_to_json(workbook.Sheets['Items'], { defval: '' });
            }
            const mapped = new Map();
            const active = [];
            const archive = [];
            summaryRows.forEach((row) => {
                const normalised = normaliseOrder(row, row.Status, { allowGenerate: false });
                if (!normalised) {
                    return;
                }
                normalised.Items = [];
                mapped.set(normalised.OrderID, normalised);
                if (normalised.Status === 'Active') {
                    active.push(normalised);
                } else {
                    archive.push(normalised);
                }
            });
            itemRows.forEach((row) => {
                const orderId = row.OrderID || row.orderId;
                const target = mapped.get(orderId);
                if (!target) {
                    return;
                }
                const item = normaliseItem(row);
                if (!item) {
                    return;
                }
                target.Items.push(item);
                if (item.isAddOn) {
                    target.HasAddOn = true;
                }
            });
            active.forEach((order) => {
                if (!order.Total || order.Total <= 0) {
                    const sum = order.Items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
                    order.Total = Number(sum.toFixed(2));
                }
            });
            archive.forEach((order) => {
                if (!order.Total || order.Total <= 0) {
                    const sum = order.Items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
                    order.Total = Number(sum.toFixed(2));
                }
            });
            return { active, archive };
        } catch (error) {
            console.warn('Varsayılan sipariş dosyası yüklenemedi.', error);
            return { active: [], archive: [] };
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
            orders: {
                active: safeClone(state.active),
                history: safeClone(state.archive),
                completed: safeClone(state.archive)
            },
            stats: safeClone(stats)
        };
    }

    function getOrders() {
        return {
            active: safeClone(state.active),
            history: safeClone(state.archive),
            completed: safeClone(state.archive)
        };
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
        const normalised = normaliseOrder(order, 'Active', { allowGenerate: true });
        if (!normalised) {
            return null;
        }
        if ((!order.OrderID && !order.orderId) && Number.isFinite(normalised.OrderNumber)) {
            normalised.OrderID = composeOrderId(normalised.CounterDate, normalised.OrderNumber);
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
            state.archive = state.archive.filter((order) => {
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
        if (formatted === 'Active') {
            state.active.unshift(target);
        } else {
            state.archive.unshift(target);
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

    function cancelOrder(orderId) {
        return updateOrderStatus(orderId, 'Cancelled');
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
            state.archive = state.archive.filter((order) => {
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
        cancelOrder,
        removeOrder,
        subscribe,
        generateOrderId
    };
})(window);
