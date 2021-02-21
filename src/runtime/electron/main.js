const { app, BrowserWindow, Menu } = require('electron')

const isMac = process.platform === 'darwin'

function _(label) {
    return label.replace(/ ?([A-Za-z0-9]+|.+)/g, function (match, string, offset) {
        return (match.match(/[A-Za-z0-9]+/)) ? (offset ? '_' : '') + match.toLowerCase().trim() : '';
    })
}

function menuItemClick(menuItem, browserWindow, event) {
    browserWindow.webContents.send('click-menuitem', menuItem.command)
}

function M({
        label,
        prefix = '',
        submenu = [],
    } = {}) {
    submenu.forEach((item, index) => {
        if (typeof item == 'string') {
            submenu[index] = { label: item, command: _(label) }
            item = submenu[index]
        }
        if (typeof item == 'object' && item['label']) {
            item['command'] = _(item['label'])
            item['accelerator'] = item['accel']
            item['click'] = menuItemClick
        }
        if (prefix) {
            item['command'] = `${prefix}_${item['command']}`
        }
    })
    return {
        label: label,
        prefix: prefix,
        submenu: submenu
    }
}

const template = [
  // { role: 'appMenu' }
  ...(isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  // { role: 'fileMenu' }
  M({
    label: 'System',
    submenu: [
      'Power',
      { label: 'Reset', accel: 'Shift+F11' },
      { type: 'separator' },
      'Netplay!',
      { type: 'separator' },
      'Open File',
      'Open URL',
      { type: 'separator' },
      { label: 'Load State', accel: 'F12' },
      'Save State',
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  }),
  M({
    label: 'Drive A', prefix: 'a',
    submenu: [
      'Load Disk Images',
      'Add Disk Images',
      'Add Blank Disk',
      'Add Boot Disk',
      'Import Files to Disk',
      'Expand ZIP to Disk',
      { label: 'Select Disk', enabled: false },
      { label: 'Save Disk Image', enabled: false },
      { label: 'Remove Disk', enabled: false },
    ]
  }),
  M({
    label: 'Drive B', prefix: 'b',
    submenu: [
      'Load Disk Images',
      'Add Disk Images',
      'Add Blank Disk',
      'Add Boot Disk',
      'Import Files to Disk',
      'Expand ZIP to Disk',
      { label: 'Select Disk', enabled: false },
      { label: 'Save Disk Image', enabled: false },
      { label: 'Remove Disk', enabled: false },
    ]
  }),
//  // { role: 'editMenu' }
//  {
//    label: 'Edit',
//    submenu: [
//      { role: 'undo' },
//      { role: 'redo' },
//      { type: 'separator' },
//     { role: 'cut' },
//     { role: 'copy' },
//     { role: 'paste' },
//     ...(isMac ? [
//       { role: 'pasteAndMatchStyle' },
//       { role: 'delete' },
//       { role: 'selectAll' },
//       { type: 'separator' },
//       {
//         label: 'Speech',
//         submenu: [
//           { role: 'startSpeaking' },
//           { role: 'stopSpeaking' }
//         ]
//       }
//     ] : [
//       { role: 'delete' },
//       { type: 'separator' },
//       { role: 'selectAll' }
//     ])
//    ]
//  },
  // { role: 'viewMenu' }
  {
    label: 'View',
    submenu: [
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
//  // { role: 'windowMenu' }
//  {
//    label: 'Window',
//    submenu: [
//      { role: 'minimize' },
//      { role: 'zoom' },
//      ...(isMac ? [
//        { type: 'separator' },
//        { role: 'front' },
//        { type: 'separator' },
//        { role: 'window' }
//      ] : [
//        { role: 'close' }
//      ])
//    ]
//  },
  M({
    label: 'Slot 1', prefix: '1',
    submenu: [
      'Load ROM Image',
      { label: 'Set ROM Format', enabled: false },
      { label: 'Load Data File', enabled: false },
      { label: 'Save Data File', enabled: false },
      { label: 'Remove Cartridge', enabled: false },
    ]
  }),
  M({
    label: 'Slot 2', prefix: '2',
    submenu: [
      'Load ROM Image',
      { label: 'Set ROM Format', enabled: false },
      { label: 'Load Data File', enabled: false },
      { label: 'Save Data File', enabled: false },
      { label: 'Remove Cartridge', enabled: false },
    ]
  }),
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          const { shell } = require('electron')
          await shell.openExternal('https://electronjs.org')
        }
      }
    ]
  }
]

function createWindow () {
  const win = new BrowserWindow({
    useContentSize: true,
    width: 682,
    height: 534,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.loadURL(`file://${__dirname}/index.html`)
  //win.webContents.openDevTools()
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

