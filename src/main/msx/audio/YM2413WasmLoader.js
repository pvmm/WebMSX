// Copyright 2015 by Paulo Augusto Peccin. See license.txt distributed with this file.

// YM2413 FM Sound Chip - WASM (emu2413) implementation

wmsx.YM2413WasmLoader = function() {
    "use strict";

    var self = this;

    this.load = function() {
        if (modulePromise) return modulePromise;

        var baseUrl = getBaseUrl();
        modulePromise = import(baseUrl + "wasm2413.mjs").then(function(mod) {
            var createModule = mod.default;
            return createModule({
                locateFile: function(path) {
                    if (path.endsWith(".wasm")) return baseUrl + "wasm2413.wasm";
                    return path;
                }
            });
        }).then(function(Module) {
            wasmModule = Module;
            return Module;
        });

        return modulePromise;
    };

    this.isReady = function() {
        return !!wasmModule;
    };

    this.whenReady = function() {
        return modulePromise || Promise.reject(new Error("WASM not requested"));
    };

    this.getOPLL = function(clock, rate) {
        if (!wasmModule) throw new Error("WASM OPLL not loaded");
        return new wmsx.YM2413WasmLoader.WasmOPLL(wasmModule, clock, rate);
    };

    function getBaseUrl() {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; --i) {
            var src = scripts[i].src;
            if (src && src.indexOf("wmsx") >= 0) {
                var lastSlash = src.lastIndexOf("/");
                return lastSlash >= 0 ? src.substring(0, lastSlash + 1) : "";
            }
        }
        return "";
    }

    var wasmModule = null;
    var modulePromise = null;

};

wmsx.YM2413WasmLoader.WasmOPLL = function(Module, clock, rate) {
    "use strict";

    var ptr = Module._OPLL_new(clock, rate);
    var stereoBuf = Module._malloc(8);

    this.reset = function() { Module._OPLL_reset(ptr); };
    this.resetPatch = function(type) { Module._OPLL_resetPatch(ptr, type); };
    this.setRate = function(r) { Module._OPLL_setRate(ptr, r); };
    this.setQuality = function(q) { Module._OPLL_setQuality(ptr, q); };
    this.setChipType = function(type) { Module._OPLL_setChipType(ptr, type); };
    this.writeIO = function(adr, val) { Module._OPLL_writeIO(ptr, adr, val); };
    this.writeReg = function(reg, val) { Module._OPLL_writeReg(ptr, reg, val); };

    this.calc = function() { return Module._OPLL_calc(ptr); };

    this.calcStereo = function() {
        Module._OPLL_calcStereo(ptr, stereoBuf);
        var left = Module.HEAP32[stereoBuf >> 2];
        var right = Module.HEAP32[(stereoBuf >> 2) + 1];
        return [left, right];
    };

    this.setPan = function(ch, pan) { Module._OPLL_setPan(ptr, ch, pan); };
    this.forceRefresh = function() { Module._OPLL_forceRefresh(ptr); };

    this.destroy = function() {
        if (ptr) { Module._OPLL_delete(ptr); ptr = 0; }
        if (stereoBuf) { Module._free(stereoBuf); stereoBuf = 0; }
    };
};

wmsx.YM2413WasmLoader.instance = null;

wmsx.YM2413WasmLoader.getLoader = function() {
    if (!wmsx.YM2413WasmLoader.instance)
        wmsx.YM2413WasmLoader.instance = new wmsx.YM2413WasmLoader();
    return wmsx.YM2413WasmLoader.instance;
};
