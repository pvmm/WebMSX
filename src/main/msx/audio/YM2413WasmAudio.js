// Copyright 2015 by Paulo Augusto Peccin. See license.txt distributed with this file.

// YM2413 FM Sound Chip - WASM (emu2413) implementation

wmsx.YM2413WasmAudio = function(pName) {
"use strict";

    var self = this;

    function init() {
        name = pName || "YM2413";
        wmsx.Util.arrayFill(register, 0);
        var VOL = (WMSX.OPLL_VOL || "f").toUpperCase();
        var PAN = (WMSX.OPLL_PAN || "8").toUpperCase();
        VOLPAN = (VOL !== "F" || PAN !== "8");
        initWasmOPLL();
    }

    this.connect = function(machine) {
        machine.bus.connectInputDevice( 0x7c, wmsx.DeviceMissing.inputPortIgnored);
        machine.bus.connectInputDevice( 0x7d, wmsx.DeviceMissing.inputPortIgnored);
        machine.bus.connectOutputDevice(0x7c, this.output7C);
        machine.bus.connectOutputDevice(0x7d, this.output7D);
        audioSocket = machine.getAudioSocket();
        if (audioConnected) connectAudio();
    };

    this.disconnect = function(machine) {
        machine.bus.disconnectInputDevice( 0x7c, wmsx.DeviceMissing.inputPortIgnored);
        machine.bus.disconnectInputDevice( 0x7d, wmsx.DeviceMissing.inputPortIgnored);
        machine.bus.disconnectOutputDevice(0x7c, this.output7C);
        machine.bus.disconnectOutputDevice(0x7d, this.output7D);
        disconnectAudio();
        audioSocket = null;
    };

    this.powerOn = function() {
        this.reset();
    };

    this.powerOff = function() {
        disconnectAudio();
    };

    this.reset = function() {
        wmsx.Util.arrayFill(register, 0);
        registerAddress = 0;
        rhythmMode = false;
        if (opll) opll.reset();
        disconnectAudio();
    };

    this.output7C = function(val) {
        registerAddress = val & 0x3f;
    };

    this.output7D = function(val) {
        registerWrite(registerAddress, val);
    };

    this.nextSample = function() {
        if (!opll) return VOLPAN ? sampleEmpty : 0;
        if (VOLPAN) {
            var s = opll.calcStereo();
            sampleResult[0] = s[0] * VOLUME;
            sampleResult[1] = s[1] * VOLUME;
            return sampleResult;
        }
        return opll.calc() * VOLUME;
    };

    function connectAudio() {
        if (audioSocket) {
            if (!audioSignal) audioSignal = new wmsx.AudioSignal(name, self, VOLUME, SAMPLE_RATE, VOLPAN);
            audioSocket.connectAudioSignal(audioSignal);
            audioConnected = true;
        }
    }

    function disconnectAudio() {
        if (audioSocket && audioSignal) audioSocket.disconnectAudioSignal(audioSignal);
        audioConnected = false;
    }

    function registerWrite(reg, val) {
        register[reg] = val;
        if (opll) opll.writeReg(reg, val);
        if (reg === 0x0e) rhythmMode = (val & 0x20) !== 0;
    }

    function initWasmOPLL() {
        var loader = wmsx.YM2413WasmLoader.getLoader();
        if (loader.isReady()) {
            createWasmOPLL(loader);
        } else {
            loader.load().then(function() {
                createWasmOPLL(loader);
            });
        }
    }

    function createWasmOPLL(loader) {
        opll = loader.getOPLL(CLOCK, SAMPLE_RATE);
        replayRegisters();
    }

    function replayRegisters() {
        if (!opll) return;
        for (var r = 0; r < register.length; r++) {
            if (register[r] !== 0) opll.writeReg(r, register[r]);
        }
    }

    // Save/load state

    this.saveState = function() {
        return {
            n: name,
            ac: audioConnected,
            ra: registerAddress,
            r: wmsx.Util.storeInt8BitArrayToStringBase64(register),
            rm: rhythmMode
        };
    };

    this.loadState = function(s) {
        this.reset();
        name = s.n;
        audioConnected = s.ac;
        registerAddress = s.ra;
        var regs = wmsx.Util.restoreStringBase64ToInt8BitArray(s.r);
        for (var r = 0; r < regs.length; r++) {
            register[r] = regs[r];
            if (opll) opll.writeReg(r, regs[r]);
        }
        rhythmMode = !!s.rm;
        if (audioConnected) connectAudio();
    };

    var name;
    var opll = null;

    var register = new Array(0x38);
    var registerAddress = 0;
    var rhythmMode = false;

    var audioSocket, audioSignal;
    var audioConnected = false;

    var VOLPAN;

    var VOLUME = 0.68 * (1.58 / 9 / 256);
    var SAMPLE_RATE = 49780;
    var CLOCK = 3579545;         // NTSC colorburst * 2

    var sampleResult = [ 0, 0 ];
    var sampleEmpty = [ 0, 0 ];

    init();

};
