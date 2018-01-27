// Copyright 2015 by Paulo Augusto Peccin. See license.txt distributed with this file.

wmsx.Room = function(screenElement, machineStartPowerOn) {
"use strict";

    var self = this;

    function init() {
        buildMainClock();
        buildPeripherals();
        buildAndPlugMachine();
    }

    this.powerOn = function() {
        self.screen.powerOn();
        self.speaker.powerOn();
        self.controllersHub.powerOn();
        self.setLoading(true);
        self.enterStandaloneMode();
        roomPowerOnTime = Date.now();
    };

    this.powerOff = function() {
        self.machine.powerOff();
        self.controllersHub.powerOff();
        self.speaker.powerOff();
        self.screen.powerOff();
    };

    this.setLoading = function(boo) {
        if (this.isLoading === boo) return;
        this.isLoading = boo;
        this.machine.setLoading(this.isLoading);
        this.screen.setLoading(this.isLoading);
    };

    this.start = function(startAction) {
        wmsx.Clock.detectHostNativeFPSAndCallback(function() {
            afterPowerONDelay(function () {
                self.setLoading(false);
                self.screen.start(startAction || machinePowerOnStartAction);
            });
        });
    };

    this.showOSD = function(message, overlap, error) {
        this.machine.showOSD(message, overlap, error);
    };

    this.mainVideoClockPulse = function() {
        if (self.machine.isSystemPaused()) return;

        if (self.netController)
            self.netController.netVideoClockPulse();
        else {
            self.controllersHub.controllersClockPulse();
            self.machine.videoClockPulse();
        }
    };

    this.enterStandaloneMode = function() {
        var oldMode = this.netPlayMode;
        this.netPlayMode = 0;
        this.netController = undefined;
        self.mainVideoClock.go();       // Local Clock

        // Restore state from before NetPlay if any
        if (this.netPlayStateBeforeClientMode) {
            this.machine.loadStateExtended(this.netPlayStateBeforeClientMode);
            // TODO NetPlay this.machineControls.setP1ControlsAndPaddleMode(this.netPlayControlsModeBeforeClientMode.p1, this.netPlayControlsModeBeforeClientMode.pd);
            this.netPlayStateBeforeClientMode = undefined;
        }

        if (oldMode !== this.netPlayMode) this.screen.roomNetPlayStatusChangeUpdate(oldMode);
    };

    this.enterNetServerMode = function(netServer) {
        var oldMode = this.netPlayMode;
        this.netPlayMode = 1;
        this.netController = netServer;
        self.mainVideoClock.go();       // Local Clock, also sent to Client

        if (oldMode !== this.netPlayMode) this.screen.roomNetPlayStatusChangeUpdate(oldMode);
    };

    this.enterNetClientMode = function(netClient) {
        var oldMode = this.netPlayMode;
        this.netPlayMode = 2;
        this.netController = netClient;
        self.mainVideoClock.pause();    // Clock comes from Server

        // Save state from before NetPlay, to be restored when session is over
        this.netPlayStateBeforeClientMode = this.machine.saveStateExtended();
        // TODO NetPlay this.netPlayControlsModeBeforeClientMode = { p1: this.machineControls.isP1ControlsMode(), pd: this.machineControls.isPaddleMode() };

        if (oldMode !== this.netPlayMode) this.screen.roomNetPlayStatusChangeUpdate(oldMode);
    };

    this.enterNetPendingMode = function(netController) {
        var oldMode = this.netPlayMode;
        this.netPlayMode = netController === this.netServer ? -1 : -2;
        this.netController = undefined;
        self.mainVideoClock.go();       // Local Clock continued

        if (oldMode !== this.netPlayMode) this.screen.roomNetPlayStatusChangeUpdate(oldMode);
    };

    this.getNetServer = function() {
        if (!this.netServer) this.netServer = new wmsx.NetServer(this);
        return this.netServer;
    };

    this.getNetClient = function() {
        if (!this.netClient) this.netClient = new wmsx.NetClient(this);
        return this.netClient;
    };

    function afterPowerONDelay(func) {
        var wait = WMSX.AUTO_POWER_ON_DELAY;
        if (wait >= 0 && WMSXFullScreenSetup.shouldStartInFullScreen()) wait += 1400;   // Wait a bit more
        wait -= (Date.now() - roomPowerOnTime);
        if (wait < 1) wait = 1;
        setTimeout(func, wait);
    }

    function machinePowerOnStartAction() {
        if (machineStartPowerOn) self.machine.userPowerOn(true);        // Auto-run cassette, or type basic commands if any
    }

    function buildMainClock() {
        // Clock frequency will be changed directly by the Machine
        self.mainVideoClock = new wmsx.Clock(self.mainVideoClockPulse);
    }

    function buildPeripherals() {
        self.peripheralControls = new wmsx.DOMPeripheralControls(self);
        self.machineControls = new wmsx.DOMMachineControls(self, self.peripheralControls);
        self.controllersHub = new wmsx.ControllersHub(self, self.machineControls);
        self.keyboard = self.controllersHub.getKeyboard();
        self.fileDownloader = new wmsx.FileDownloader();
        self.stateMedia = new wmsx.LocalStorageSaveStateMedia(self);
        self.cartridgeSlot = new wmsx.FileCartridgeSlot(self);
        self.cassetteDeck = new wmsx.FileCassetteDeck(self);
        self.diskDrive = new wmsx.FileDiskDrive(self);
        self.fileLoader = new wmsx.FileLoader();
        self.screen = new wmsx.CanvasDisplay(screenElement);
        self.speaker = new wmsx.WebAudioSpeaker(screenElement);

        self.fileLoader.connectPeripherals(self.peripheralControls, self.cartridgeSlot, self.cassetteDeck, self.diskDrive);
        self.fileDownloader.connectPeripherals(self.screen);
        self.screen.connectPeripherals(self.fileLoader, self.fileDownloader, self.machineControls, self.peripheralControls, self.controllersHub, self.diskDrive, self.stateMedia);
        self.speaker.connectPeripherals(self.screen);
        self.machineControls.connectPeripherals(self.screen);
        self.controllersHub.connectPeripherals(self.screen);
        self.stateMedia.connectPeripherals(self.fileDownloader);
        self.cartridgeSlot.connectPeripherals(self.fileDownloader);
        self.cassetteDeck.connectPeripherals(self.screen, self.fileDownloader);
        self.diskDrive.connectPeripherals(self.screen, self.fileDownloader);
        self.peripheralControls.connectPeripherals(self.cartridgeSlot, self.machineControls,self.screen, self.speaker, self.controllersHub, self.fileLoader, self.cassetteDeck, self.diskDrive);
    }

    function buildAndPlugMachine() {
        self.machine = new wmsx.Machine(self.mainVideoClock);
        self.stateMedia.connect(self.machine.getSavestateSocket());
        self.fileLoader.connect(self.machine);
        self.screen.connect(self.machine);
        self.speaker.connect(self.machine.getAudioSocket());
        self.machineControls.connect(self.machine.getMachineControlsSocket());
        self.controllersHub.connect(self.machine.getMachineControlsSocket(), self.machine.getControllersSocket(), self.machine.getBIOSSocket());
        self.cartridgeSlot.connect(self.machine.getCartridgeSocket());
        self.cassetteDeck.connect(self.machine.getCassetteSocket());
        self.diskDrive.connect(self.machine.getDiskDriveSocket());
        self.peripheralControls.connect(self.machine.getCartridgeSocket());
    }


    this.mainVideoClock = null;
    this.machine = null;
    this.screen = null;
    this.speaker = null;
    this.machineControls = null;
    this.controllersHub = null;
    this.keyboard = null;
    this.fileDownloader = null;
    this.cartridgeSlot = null;
    this.cassetteDeck = null;
    this.diskDrive = null;
    this.stateMedia = null;
    this.fileLoader = null;
    this.peripheralControls = null;

    this.netPlayMode = 0;       // -1 = pending, 0 = standalone, 1 = server, 2 = client
    this.netController = undefined;
    this.netServer = undefined;
    this.netClient = undefined;
    this.netPlayStateBeforeClientMode = undefined;
    this.netPlayControlsModeBeforeClientMode = undefined;

    this.isLoading = false;

    var roomPowerOnTime;


    init();

};

