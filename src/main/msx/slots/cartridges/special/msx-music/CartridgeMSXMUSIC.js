// Copyright 2015 by Paulo Augusto Peccin. See license.txt distributed with this file.

// MSX-MUSIC Expansion with 16K ROM
// Controls a YM2413 FM sound chip
// 0x4000 - 0x7fff

wmsx.CartridgeMSXMUSIC = function(rom) {
"use strict";

    function init(self) {
        self.rom = rom;
        bytes = wmsx.Util.asNormalArray(rom.content);
        self.bytes = bytes;
    }

    this.connect = function(pMachine) {
        machine = pMachine;
        opll.connect(pMachine);
    };

    this.disconnect = function(pMachine) {
        opll.disconnect(pMachine);
        machine = null;
    };

    this.powerOn = function() {
        opll.powerOn();
        this.reset();
    };

    this.powerOff = function() {
        opll.powerOff();
    };

    this.reset = function() {
        opll.reset();
    };

    this.read = function(address) {
        if (address >= 0x4000 && address < 0x8000)      // page 1 only
            return bytes[address - 0x4000];
        return 0xff;
    };

    var bytes;
    this.bytes = null;

    var machine = null;

    this.rom = null;
    this.format = wmsx.SlotFormats.MSXMUSIC;

    var opll = new wmsx.YM2413WasmAudio("MSX-MUSIC");
    this.opll = opll;


    // Savestate  -------------------------------------------

    this.saveState = function() {
        return {
            f: this.format.name,
            r: this.rom.saveState(),
            b: this.lightState() ? null : wmsx.Util.compressInt8BitArrayToStringBase64(bytes),
            fm: opll.saveState()
        };
    };

    this.loadState = function(s) {
        this.rom = wmsx.ROM.loadState(s.r);
        if (s.b)
            bytes = wmsx.Util.uncompressStringBase64ToInt8BitArray(s.b, bytes);
        else {
            this.rom.reloadEmbeddedContent();
            if (!bytes || bytes.length !== this.rom.content.length) bytes = new Array(this.rom.content.length);
            wmsx.Util.arrayCopy(this.rom.content, 0, bytes);
        }
        this.bytes = bytes;
        opll.loadState(s.fm);
    };


    if (rom) init(this);

};

wmsx.CartridgeMSXMUSIC.prototype = wmsx.Slot.base;

wmsx.CartridgeMSXMUSIC.recreateFromSaveState = function(state, previousSlot) {
    var cart = previousSlot || new wmsx.CartridgeMSXMUSIC();
    cart.loadState(state);
    return cart;
};
