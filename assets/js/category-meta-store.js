(function (global) {
    const STORAGE_KEY = 'sandwichXL_categoryMeta';
    const listeners = new Set();
    const DEFAULT_LABELS = {
        sandwiches: 'Sandviçler',
        pasta: 'Makarnalar',
        salads: 'Salatalar',
        desserts: 'Tatlılar',
        drinks: 'İçecekler'
    };
    const CATEGORY_EVENT = 'sandwichXL:categoryMetaChanged';

    function safeClone(value) {
        try {
            return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
        } catch (error) {
            return JSON.parse(JSON.stringify(value));
        }
    }

    function ensureMenuStore() {
        return global.MenuDataStore || null;
    }

    function getDefaultMenuKeys() {
        const store = ensureMenuStore();
        if (!store) {
            return [];
        }
        const defaults = store.getDefaultMenuData();
        return Object.keys(defaults).filter((key) => key && !key.startsWith('_'));
    }

    function getDefaultMeta() {
        const order = getDefaultMenuKeys();
        const labels = {};
        order.forEach((key) => {
            labels[key] = DEFAULT_LABELS[key] || formatLabelFromKey(key);
        });
        return { order, labels };
    }

    function formatLabelFromKey(key) {
        if (!key) return '';
        return key
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function normaliseMeta(meta, menuData) {
        const base = meta && typeof meta === 'object' ? meta : {};
        const orderSource = Array.isArray(base.order) ? base.order.slice() : getDefaultMeta().order;
        const labelsSource = base.labels && typeof base.labels === 'object' ? base.labels : {};
        const seen = new Set();
        const normalisedOrder = [];

        orderSource.forEach((key) => {
            if (!key || seen.has(key)) return;
            seen.add(key);
            normalisedOrder.push(key);
        });

        const allKeys = menuData ? Object.keys(menuData) : [];
        allKeys.forEach((key) => {
            if (!key || key.startsWith('_') || seen.has(key)) return;
            seen.add(key);
            normalisedOrder.push(key);
        });

        if (normalisedOrder.length === 0) {
            return getDefaultMeta();
        }

        const labels = {};
        normalisedOrder.forEach((key) => {
            const candidate = typeof labelsSource[key] === 'string' ? labelsSource[key].trim() : '';
            labels[key] = candidate || DEFAULT_LABELS[key] || formatLabelFromKey(key);
        });

        return { order: normalisedOrder, labels };
    }

    function readFromStorage() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (error) {
            console.warn('Kategori meta verisi okunamadı.', error);
            return null;
        }
    }

    function persist(meta) {
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
        } catch (error) {
            console.warn('Kategori meta verisi kaydedilemedi.', error);
        }
    }

    function broadcast(meta) {
        const clone = safeClone(meta);
        listeners.forEach((listener) => {
            try {
                listener(clone);
            } catch (error) {
                console.error('Kategori meta dinleyicisinde hata oluştu.', error);
            }
        });
        const event = new CustomEvent(CATEGORY_EVENT, { detail: clone });
        global.dispatchEvent(event);
    }

    function loadMeta(menuData) {
        const store = ensureMenuStore();
        const currentMenu = menuData || (store ? store.loadMenuData() : {});
        const stored = readFromStorage();
        const normalised = normaliseMeta(stored, currentMenu);
        persist(normalised);
        return safeClone(normalised);
    }

    function saveMeta(nextMeta, menuData) {
        const store = ensureMenuStore();
        const currentMenu = menuData || (store ? store.loadMenuData() : {});
        const normalised = normaliseMeta(nextMeta, currentMenu);
        persist(normalised);
        broadcast(normalised);
        return safeClone(normalised);
    }

    function ensureSynced(menuData) {
        const store = ensureMenuStore();
        const currentMenu = menuData || (store ? store.loadMenuData() : {});
        const stored = readFromStorage();
        const normalised = normaliseMeta(stored, currentMenu);
        persist(normalised);
        return safeClone(normalised);
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function generateKey(label, existingKeys) {
        const baseLabel = typeof label === 'string' ? label.trim() : '';
        if (!baseLabel) {
            return '';
        }
        const slugBase = baseLabel
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'kategori';
        const used = new Set(Array.isArray(existingKeys) ? existingKeys : []);
        if (!used.size) {
            ensureSynced();
            const meta = readFromStorage();
            if (meta && Array.isArray(meta.order)) {
                meta.order.forEach((key) => used.add(key));
            }
        }
        if (!used.has(slugBase)) {
            return slugBase;
        }
        let counter = 2;
        let candidate = `${slugBase}-${counter}`;
        while (used.has(candidate)) {
            counter += 1;
            candidate = `${slugBase}-${counter}`;
        }
        return candidate;
    }

    function handleStorage(event) {
        if (event.key !== STORAGE_KEY || typeof event.newValue !== 'string') {
            return;
        }
        try {
            const parsed = JSON.parse(event.newValue);
            const store = ensureMenuStore();
            const menu = store ? store.loadMenuData() : {};
            const normalised = normaliseMeta(parsed, menu);
            persist(normalised);
            broadcast(normalised);
        } catch (error) {
            console.warn('Kategori meta güncellemesi okunamadı.', error);
        }
    }

    function handleMenuChange(event) {
        const detail = event && event.detail ? event.detail : null;
        ensureSynced(detail);
        const meta = loadMeta(detail);
        broadcast(meta);
    }

    global.addEventListener('storage', handleStorage);
    global.addEventListener('sandwichXL:menuDataChanged', handleMenuChange);

    global.CategoryMetaStore = {
        loadMeta,
        saveMeta,
        ensureSynced,
        subscribe,
        generateKey,
        getDefaultMeta
    };
})(window);
