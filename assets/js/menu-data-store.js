(function (global) {
    const STORAGE_KEY = 'sandwichXL_menuData';
    const ADMIN_MODE_KEY = 'sandwichXL_adminMode';

    const listeners = new Set();

    function safeClone(value) {
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                console.warn('structuredClone failed, falling back to JSON clone.', error);
            }
        }

        return JSON.parse(JSON.stringify(value));
    }

    function getDefaultMenuData() {
        const defaults = global.SandwichXLDefaultMenuData || {};
        return safeClone(defaults);
    }

    function ensureArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normaliseMenuData(data) {
        const defaults = getDefaultMenuData();
        const result = {};

        const source = data && typeof data === 'object' ? data : defaults;
        const keys = new Set([...Object.keys(defaults), ...Object.keys(source)]);
        keys.forEach((key) => {
            const list = ensureArray(source[key]);
            result[key] = list.map((item, index) => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const safeItem = Object.assign({}, item);
                safeItem.id = safeItem.id || `${key}-${index}`;
                safeItem.name = safeItem.name || `Ürün ${index + 1}`;
                safeItem.sizes = ensureArray(safeItem.sizes).map((sizeEntry) => {
                    if (!sizeEntry || typeof sizeEntry !== 'object') {
                        return null;
                    }
                    const safeSize = Object.assign({}, sizeEntry);
                    safeSize.size = safeSize.size || 'XL';
                    safeSize.price = Number.isFinite(Number(safeSize.price)) ? Number(safeSize.price) : 0;
                    safeSize.weight = safeSize.weight || '';
                    return safeSize;
                }).filter(Boolean);
                return safeItem;
            }).filter(Boolean);
        });

        return result;
    }

    function loadMenuData() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                const defaults = getDefaultMenuData();
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
                return defaults;
            }

            const parsed = JSON.parse(raw);
            return normaliseMenuData(parsed);
        } catch (error) {
            console.warn('Menü verisi yüklenirken hata oluştu, varsayılanlar kullanılıyor.', error);
            const defaults = getDefaultMenuData();
            try {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
            } catch (storeError) {
                console.warn('Varsayılan menü verisi kaydedilemedi.', storeError);
            }
            return defaults;
        }
    }

    function saveMenuData(data) {
        const safeData = normaliseMenuData(data);
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
        } catch (error) {
            console.error('Menü verisi kaydedilemedi.', error);
        }
        broadcastChange(safeData);
        return safeData;
    }

    function resetMenuData() {
        const defaults = getDefaultMenuData();
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        } catch (error) {
            console.error('Varsayılan menü verisi kaydedilemedi.', error);
        }
        broadcastChange(defaults);
        return defaults;
    }

    function broadcastChange(data) {
        const clone = safeClone(data);
        listeners.forEach((listener) => {
            try {
                listener(clone);
            } catch (error) {
                console.error('Menü verisi dinleyicisinde hata oluştu.', error);
            }
        });
        const customEvent = new CustomEvent('sandwichXL:menuDataChanged', { detail: clone });
        global.dispatchEvent(customEvent);
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function handleStorage(event) {
        if (event.key !== STORAGE_KEY) {
            return;
        }
        try {
            const parsed = JSON.parse(event.newValue);
            broadcastChange(normaliseMenuData(parsed));
        } catch (error) {
            console.warn('Dış depolama değişimi okunamadı.', error);
        }
    }

    function isAdminModeEnabled() {
        try {
            return global.localStorage.getItem(ADMIN_MODE_KEY) === 'true';
        } catch (error) {
            console.warn('Admin modu okunamadı.', error);
            return false;
        }
    }

    function setAdminMode(value) {
        const enabled = Boolean(value);
        try {
            global.localStorage.setItem(ADMIN_MODE_KEY, enabled ? 'true' : 'false');
        } catch (error) {
            console.warn('Admin modu kaydedilemedi.', error);
        }
        const event = new CustomEvent('sandwichXL:adminModeChanged', { detail: { enabled } });
        global.dispatchEvent(event);
        return enabled;
    }

    function clearAllData() {
        try {
            global.localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn('Menü verisi temizlenemedi.', error);
        }
        return resetMenuData();
    }

    global.addEventListener('storage', handleStorage);

    global.MenuDataStore = {
        getDefaultMenuData,
        loadMenuData,
        saveMenuData,
        resetMenuData,
        clearAllData,
        subscribe,
        setAdminMode,
        isAdminModeEnabled,
        STORAGE_KEY,
        ADMIN_MODE_KEY
    };
})(window);