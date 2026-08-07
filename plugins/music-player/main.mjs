import { dialog, shell } from 'electron'
import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseFile } from 'music-metadata'

const AUDIO_EXTENSIONS = new Set(['.wav', '.flac'])

let panelWindow = null

async function scanFolder(folderPath) {
  const entries = await readdir(folderPath, { withFileTypes: true })
  const fileNames = entries
    .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'))

  const tracks = []
  for (const fileName of fileNames) {
    const filePath = join(folderPath, fileName)
    const ext = extname(fileName).toLowerCase()
    const base = {
      fileName,
      fileUrl: pathToFileURL(filePath).href,
      title: basename(fileName, extname(fileName)),
      artist: null,
      album: null,
      trackNo: null,
      container: ext.slice(1).toUpperCase(),
      codec: null,
      sampleRate: null,
      bitsPerSample: null,
      channels: null,
      duration: null,
      lossless: ext === '.wav' ? true : null,
      parseError: null
    }
    try {
      // duration:true forces a full scan when the header alone doesn't carry
      // it (common for plain WAV) — fine at this scale (a folder of tracks,
      // not a whole library).
      const meta = await parseFile(filePath, { duration: true })
      tracks.push({
        ...base,
        title: meta.common.title || base.title,
        artist: meta.common.artist || null,
        album: meta.common.album || null,
        trackNo: meta.common.track?.no ?? null,
        container: meta.format.container || base.container,
        codec: meta.format.codec || null,
        sampleRate: meta.format.sampleRate || null,
        bitsPerSample: meta.format.bitsPerSample || null,
        channels: meta.format.numberOfChannels || null,
        duration: meta.format.duration || null,
        lossless: meta.format.lossless ?? base.lossless
      })
    } catch (err) {
      // A file that fails to parse still shows up (playable via the browser's
      // own decoder even without metadata) instead of silently disappearing.
      tracks.push({ ...base, parseError: String(err?.message ?? err) })
    }
  }
  return tracks
}

export function onload(app) {
  app.registerCommand('open', '開啟音樂播放器', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.show()
      panelWindow.focus()
      return
    }

    panelWindow = app.openPanel('panel.html', {
      width: 480,
      height: 640,
      title: '音樂播放器',
      methods: {
        async pickFolder() {
          const result = await dialog.showOpenDialog(panelWindow, {
            properties: ['openDirectory']
          })
          if (result.canceled || result.filePaths.length === 0) return null
          app.storage.set('lastFolder', result.filePaths[0])
          return result.filePaths[0]
        },
        async scanFolder(folderPath) {
          app.storage.set('lastFolder', folderPath)
          return scanFolder(folderPath)
        },
        getLastFolder() {
          return app.storage.get('lastFolder', null)
        },
        async openInSpotify(query) {
          await shell.openExternal(`https://open.spotify.com/search/${encodeURIComponent(query)}`)
        }
      }
    })
  })
}

export function onunload() {}
