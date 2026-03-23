import { Editor } from './editor.mjs';
import { Library } from './library.mjs';
import { Scope } from './scope.mjs';
import { UI } from './ui.mjs';
import { getCodeFromUrl, getUrlFromCode } from './url.mjs';

const editor = new Editor();
const library = new Library();
const scope = new Scope();
const ui = new UI();

globalThis.bytebeat = new class {
	constructor() {
		this.audioCtx = null;
		this.audioGain = null;
		this.audioRecordChunks = [];
		this.audioRecorder = null;
		this.audioWorkletNode = null;
		this.byteSample = 0;
		this.defaultSettings = {
			codeStyle: 'Atom Dark',
			audioCtxSampleRate: 48000,
			audioCtxBufferSize: 0,
			showExtraFftChannels: false,
			showMonoFft: true,
			showFftFill: false,
			fftBlendMode: 'lighter',
			fontFamily: 'default',
			customFont: 'monospace',
			fontSize: 1,
			colorDiagramLeft: '#008000',
			colorDiagramCenter: '#0080ff',
			colorDiagramMono: '#00ffff',
			colorDiagramRight: '#0000ff',
			colorTimeCursor: '#80bbff',
			colorWaveformLeft: '#00ff00',
			colorWaveformCenter: '#ffffff',
			colorWaveformMono: '#ffffff',
			colorWaveformRight: '#ff00ff',
			drawMode: scope.drawMode,
			drawScale: scope.drawScale,
			fftBinSize: 1024,
			isSeconds: false,
			showAllSongs: library.showAllSongs,
			srDivisor: 1,
			themeStyle: 'Default',
			volume: .5,
			donotChangeScopePreferences: false
		};
		this.isCompilationError = false;
		this.isNeedClear = false;
		this.isPlaying = false;
		this.isOfflineRendering = false;
		this.isRecording = false;
		this.mode = 'Bytebeat';
		this.playbackSpeed = 1;
		this.sampleRate = 8000;
		this.settings = this.defaultSettings;
		this.audioFiles = new Map();
		this.init();
	}
	handleEvent(e) {
		let elem = e.target;
		switch(e.type) {
		case 'change':
			switch(elem.id) {
			case 'control-code-style': this.setCodeStyle(elem.value); break;
			case 'control-audioctx-samplerate': this.setAudioCtxSampleRate(+elem.value); break;
			case 'control-buffer-size': this.setAudioCtxBufferSize(+elem.value); break;
			case 'control-fft-extra': this.setExtraFftChannels(elem.checked); break;
			case 'control-fft-mono': this.setMonoFft(elem.checked); break;
			case 'control-fft-fill': this.setFftFill(elem.checked); break;
			case 'control-fft-blend': this.setFftBlendMode(elem.value); break;
			case 'control-font-family': this.setFontFamily(elem.value); break;
			case 'control-font-size': this.setFontSize(+elem.value); break;
			case 'control-color-diagram-left': this.setColorDiagramLeft(elem.value); break;
			case 'control-color-diagram-mono': this.setColorDiagramMono(elem.value); break;
			case 'control-color-diagram-center': this.setColorDiagramCenter(elem.value); break;
			case 'control-color-diagram-right': this.setColorDiagramRight(elem.value); break;
			case 'control-color-timecursor': this.setColorTimeCursor(elem.value); break;
			case 'control-color-waveform-left': this.setColorWaveformLeft(elem.value); break;
			case 'control-color-waveform-mono': this.setColorWaveformMono(elem.value); break;
			case 'control-color-waveform-center': this.setColorWaveformCenter(elem.value); break;
			case 'control-color-waveform-right': this.setColorWaveformRight(elem.value); break;
			case 'control-drawmode': this.setDrawMode(elem.value); break;
			case 'control-mode': this.setPlaybackMode(elem.value); break;
			case 'control-samplerate':
				this.setSampleRate(+elem.value);
				break;
			case 'control-samplerate-select':
				this.setSampleRate(elem.value === 'ctx' ? 'ctx' : +elem.value);
				break;
			case 'control-theme-style': this.setThemeStyle(elem.value); break;
			case 'library-show-all':
				library.toggleAll(elem, elem.checked);
				this.saveSettings();
				break;
			case 'DONOTCHANGESCOPEPREFERENCES':
				this.settings.donotChangeScopePreferences = elem.checked;
				this.saveSettings();
				break;
			}
			return;
		case 'click':
			switch(elem.tagName) {
			case 'svg': elem = elem.parentNode; break;
			case 'use': elem = elem.parentNode.parentNode; break;
			default:
				if(elem.classList.contains('control-fast-multiplier')) {
					elem = elem.parentNode;
				}
			}
			switch(elem.id) {
			case 'canvas-container':
			case 'canvas-main':
			case 'canvas-play':
			case 'canvas-timecursor': this.playbackToggle(!this.isPlaying); break;
			case 'control-counter':
			case 'control-pause': this.playbackToggle(false); break;
			case 'control-expand': ui.expandEditor(); break;
			case 'control-error-position': ui.toggleErrorPosition(); break;
			case 'control-link': ui.copyLink(); break;
			case 'control-play-backward': this.playbackToggle(true, true, -1); break;
			case 'control-play-forward': this.playbackToggle(true, true, 1); break;
			case 'control-rec': this.toggleRecording(); break;
			case 'control-reset': this.resetTime(); break;
			case 'control-scale': this.setScale(scope.drawMode === 'FFT' ? 0 : -scope.drawScale); break;
			case 'control-scaledown': this.setScale(scope.drawMode === 'FFT' ? 1 : -1, elem); break;
			case 'control-scaleup': this.setScale(scope.drawMode === 'FFT' ? -1 : 1); break;
			case 'control-srdivisor-down': this.setSRDivisor(-1); break;
			case 'control-srdivisor-up': this.setSRDivisor(1); break;
			case 'control-stop': this.playbackStop(); break;
			case 'control-counter-units': this.toggleCounterUnits(); break;
			default:
				if(elem.classList.contains('code-text')) {
					const songData = elem.hasAttribute('data-songdata') ? JSON.parse(elem.dataset.songdata) : {};
					const inputMode = elem.dataset.inputmode || songData.inputMode || songData.mode || 'Bytebeat';
					this.loadCode(Object.assign({ code: elem.innerText, inputMode }, songData));
				} else if(elem.classList.contains('code-load')) {
					if (elem.dataset.file) {
						this.loadTB3FromUrl(elem.dataset.file);
					} else if(elem.dataset.codefile) {
						const songData = elem.hasAttribute('data-songdata') ? JSON.parse(elem.dataset.songdata) : {};
						const inputMode = elem.dataset.inputmode || songData.inputMode || songData.mode || 'Bytebeat';
						editor.showLoading();
						fetch(elem.dataset.codefile)
							.then(response => response.text())
							.then(code => {
								this.loadCode(Object.assign({ code, inputMode }, songData));
							})
							.catch(err => {
								console.error('Failed to load code file', err);
							})
							.finally(() => {
								setTimeout(() => editor.hideLoading(), 100);
							});
					} else {
						library.onclickCodeLoadButton(elem);
					}
				} else if(elem.classList.contains('code-remix-load')) {
					library.onclickRemixLoadButton(elem);
				} else if(elem.classList.contains('library-header')) {
					if(elem.closest('#exotic-projects')) {
						this.toggleExoticSection(elem);
					} else {
						library.onclickLibraryHeader(elem);
					}
				} else if(elem.parentNode.classList.contains('library-header')) {
					if(elem.parentNode.closest('#exotic-projects')) {
						this.toggleExoticSection(elem.parentNode);
					} else {
						library.onclickLibraryHeader(elem.parentNode);
					}
				}
			}
			return;
		case 'input':
			switch(elem.id) {
			case 'control-counter': this.oninputCounter(e); break;
			case 'control-custom-font': this.setCustomFont(elem.value); break;
			case 'control-font-size': this.setFontSize(+elem.value); break;
			case 'control-volume': this.setVolume(false); break;
			}
			return;
		case 'keydown':
			if(elem.id === 'control-counter') {
				this.oninputCounter(e);
			}
			return;
		case 'mouseover':
			if(elem.classList.contains('code-load')) {
				elem.title = `Click to play the ${ elem.dataset.type } code`;
			} else if(elem.classList.contains('code-text')) {
				elem.title = 'Click to play this code';
			} else if(elem.classList.contains('songs-header')) {
				elem.title = 'Click to show/hide the songs';
			}
			return;
		}
	}
	async init() {
		try {
			this.settings = JSON.parse(localStorage.settings);
			if(this.settings.drawMode === 'FFT_1024') {
				this.settings.drawMode = 'FFT';
				this.saveSettings();
			}
			if(this.settings.fftBinSize === undefined) {
				this.settings.fftBinSize = this.defaultSettings.fftBinSize;
				this.saveSettings();
			}
			if(this.settings.audioCtxBufferSize === undefined && this.settings.bufferSize !== undefined) {
				this.settings.audioCtxBufferSize = this.settings.bufferSize;
				delete this.settings.bufferSize;
				this.saveSettings();
			}
			scope.drawMode = this.settings.drawMode;
			scope.drawScale = this.settings.drawScale;
			library.showAllSongs = this.settings.showAllSongs;
		} catch(err) {
			this.saveSettings();
		}
		if(this.settings.audioCtxSampleRate === undefined) {
			this.settings.audioCtxSampleRate = this.defaultSettings.audioCtxSampleRate;
			this.saveSettings();
		}
		if(this.settings.audioCtxBufferSize === undefined) {
			this.settings.audioCtxBufferSize = this.defaultSettings.audioCtxBufferSize;
			this.saveSettings();
		}
		this.setThemeStyle();
		await this.initAudio();
		if(ui.controlAudioCtxSampleRate) {
			ui.controlAudioCtxSampleRate.value = this.settings.audioCtxSampleRate || this.audioCtx.sampleRate;
		}
		if(document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.initAfterDom());
			return;
		}
		this.initAfterDom();
	}
	initAfterDom() {
		// Show loading overlay during editor initialization
		const editorLoading = document.getElementById('editor-loading');
		if(editorLoading) {
			editorLoading.classList.remove('hidden');
		}
		
		// Use setTimeout to allow loading overlay to show
		setTimeout(() => {
			editor.init();
			ui.initElements();
			scope.initElements();
			library.initElements();
			this.setVolume(true);
			this.setCounterUnits();
			this.setCodeStyle();
			this.setFontFamily();
			this.setCustomFont();
			this.setFontSize();
			this.ensureColorSettings();
			this.setColorWaveformLeft();
			this.setColorWaveformMono();
			this.setColorWaveformCenter();
			this.setColorWaveformRight();
			this.setColorDiagramLeft();
			this.setColorDiagramMono();
			this.setColorDiagramCenter();
			this.setColorDiagramRight();
			this.setColorTimeCursor();
			if(scope.drawMode === 'FFT') {
				this.updateScaleDisplay();
			} else {
				this.setScale(0);
			}
			this.applyFftBinSize(this.settings.fftBinSize || this.defaultSettings.fftBinSize);
			this.updateScaleDisplay();
			this.setScopePreferencesCheckbox();
			this.parseUrl();
		this.sendData({ drawMode: scope.drawMode });
		ui.controlDrawMode.value = scope.drawMode;
			ui.controlThemeStyle.value = this.settings.themeStyle;
			ui.controlCodeStyle.value = this.settings.codeStyle;
			if(ui.controlAudioCtxSampleRate) {
				ui.controlAudioCtxSampleRate.value = this.settings.audioCtxSampleRate || 48000;
			}
			if(ui.controlBufferSize) {
				ui.controlBufferSize.value = this.settings.audioCtxBufferSize || 0;
			}
			const ctxOption = ui.controlSampleRateSelect?.querySelector('option[value="ctx"]');
			if(ctxOption && this.audioCtx) {
				ctxOption.textContent = `AudioCtx (${ this.audioCtx.sampleRate }Hz)`;
			}
			if(ui.controlFontFamily) ui.controlFontFamily.value = this.settings.fontFamily;
			if(ui.controlCustomFont) ui.controlCustomFont.value = this.settings.customFont;
			if(ui.controlFontSize) ui.controlFontSize.value = this.settings.fontSize;
			if(ui.controlFftExtra) ui.controlFftExtra.checked = !!this.settings.showExtraFftChannels;
			if(ui.controlFftMono) ui.controlFftMono.checked = this.settings.showMonoFft !== false;
			if(ui.controlFftFill) ui.controlFftFill.checked = !!this.settings.showFftFill;
			if(ui.controlFftBlend) ui.controlFftBlend.value = this.settings.fftBlendMode || 'source-over';
			ui.mainElem.addEventListener('click', this);
			ui.mainElem.addEventListener('change', this);
			ui.containerFixed.addEventListener('input', this);
			ui.containerFixed.addEventListener('keydown', this);
			ui.containerScroll.addEventListener('mouseover', this);
			this.initFileManager();
			this.loadExoticProjects();
			
			// Hide the initial loading overlay
			if(editorLoading) {
				editorLoading.classList.add('hidden');
			}
		}, 50);
	}
	async initAudio(sampleRateOverride) {
		const sampleRate = this.sanitizeAudioCtxSampleRate(sampleRateOverride ?? this.settings.audioCtxSampleRate);
		const bufferSize = this.sanitizeAudioCtxBufferSize(this.settings.audioCtxBufferSize);
		const latencyHint = bufferSize ? bufferSize / sampleRate : 'balanced';
		this.audioCtx = new AudioContext({ latencyHint, sampleRate });
		if(this.audioCtx.sampleRate && this.settings.audioCtxSampleRate !== this.audioCtx.sampleRate) {
			this.settings.audioCtxSampleRate = this.audioCtx.sampleRate;
			this.saveSettings();
		}
		scope.showExtraFftChannels = !!this.settings.showExtraFftChannels;
		scope.showMonoFft = this.settings.showMonoFft !== false;
		scope.showFftFill = !!this.settings.showFftFill;
		scope.fftBlendMode = this.settings.fftBlendMode || 'source-over';
		this.audioGain = new GainNode(this.audioCtx);
		this.audioGain.connect(this.audioCtx.destination);
		await this.audioCtx.audioWorklet.addModule('./build/audio-processor.mjs');
		this.audioWorkletNode = new AudioWorkletNode(this.audioCtx, 'audioProcessor',
			{ outputChannelCount: [2] });
		this.audioWorkletNode.port.addEventListener('message', e => this.receiveData(e.data));
		this.audioWorkletNode.port.start();
		// Setup analyser for FFT
			scope.analyser = this.audioCtx.createAnalyser();
			scope.analyser.smoothingTimeConstant = 0.7;
			scope.analyserData = new Uint8Array(scope.analyser.frequencyBinCount);
			this.analyserGain = new GainNode(this.audioCtx, { gain: 0.1 }); // scale down to 10%
			this.audioWorkletNode.connect(this.analyserGain);
			this.analyserGain.connect(scope.analyser);
			this.audioWorkletNode.connect(this.audioGain);
			if(scope.showExtraFftChannels) {
				this.fftWorkletNode = new AudioWorkletNode(this.audioCtx, 'audioProcessor',
					{ outputChannelCount: [3] });
				this.fftWorkletNode.port.start();
				const splitter = new ChannelSplitterNode(this.audioCtx, { numberOfOutputs: 3 });
				this.fftWorkletNode.connect(splitter);
				const fftGainLeft = new GainNode(this.audioCtx, { gain: 0.1 });
				const fftGainCenter = new GainNode(this.audioCtx, { gain: 0.1 });
				const fftGainRight = new GainNode(this.audioCtx, { gain: 0.1 });
				scope.analyserLeft = this.audioCtx.createAnalyser();
				scope.analyserCenter = this.audioCtx.createAnalyser();
				scope.analyserRight = this.audioCtx.createAnalyser();
				scope.analyserLeft.smoothingTimeConstant = 0.7;
				scope.analyserCenter.smoothingTimeConstant = 0.7;
				scope.analyserRight.smoothingTimeConstant = 0.7;
				splitter.connect(fftGainLeft, 0);
				splitter.connect(fftGainCenter, 1);
				splitter.connect(fftGainRight, 2);
				fftGainLeft.connect(scope.analyserLeft);
				fftGainCenter.connect(scope.analyserCenter);
				fftGainRight.connect(scope.analyserRight);
				scope.analyserLeftData = new Uint8Array(scope.analyserLeft.frequencyBinCount);
				scope.analyserCenterData = new Uint8Array(scope.analyserCenter.frequencyBinCount);
				scope.analyserRightData = new Uint8Array(scope.analyserRight.frequencyBinCount);
			} else {
				this.fftWorkletNode = null;
				scope.analyserLeft = null;
				scope.analyserCenter = null;
				scope.analyserRight = null;
				scope.analyserLeftData = null;
				scope.analyserCenterData = null;
				scope.analyserRightData = null;
			}
			this.applyFftBinSize(this.settings.fftBinSize || this.defaultSettings.fftBinSize);
		const mediaDest = this.audioCtx.createMediaStreamDestination();
		const audioRecorder = this.audioRecorder = new MediaRecorder(mediaDest.stream);
		audioRecorder.addEventListener('dataavailable', e => this.audioRecordChunks.push(e.data));
		audioRecorder.addEventListener('stop', () => {
			let fileName, type;
			const types = ['audio/webm', 'audio/ogg'];
			const files = ['track.webm', 'track.ogg'];
			while((fileName = files.pop()) && !MediaRecorder.isTypeSupported(type = types.pop())) {
				if(types.length === 0) {
					console.error('Recording is not supported in this browser!');
					break;
				}
			}
			const url = URL.createObjectURL(new Blob(this.audioRecordChunks, { type }));
			ui.downloader.href = url;
			ui.downloader.download = fileName;
			ui.downloader.click();
			setTimeout(() => window.URL.revokeObjectURL(url));
		});
		this.audioGain.connect(mediaDest);
	}
	initFileManager() {
		const addFileBtn = document.getElementById('add-file');
		const clearFilesBtn = document.getElementById('clear-files');
		const fileInput = document.getElementById('file-input');
		const loadTB3Btn = document.getElementById('load-tb3');
		const tb3Input = document.getElementById('tb3-input');
		const offlineRenderBtn = document.getElementById('offline-render-wav');
		
		addFileBtn.addEventListener('click', () => fileInput.click());
		clearFilesBtn.addEventListener('click', () => this.clearAllFiles());
		fileInput.addEventListener('change', e => this.handleFileSelect(e));
		loadTB3Btn.addEventListener('click', () => tb3Input.click());
		tb3Input.addEventListener('change', e => this.handleTB3Select(e));
		document.getElementById('save-tb3').addEventListener('click', () => this.saveTB3());
		if(offlineRenderBtn) {
			offlineRenderBtn.addEventListener('click', () => this.renderOfflineWav());
		}
	}
	async handleFileSelect(e) {
		const files = Array.from(e.target.files);
		for(const file of files) {
			if(file.type.startsWith('audio/')) {
				await this.handleAudioFile(file);
			}
		}
		this.updateFileList();
		this.sendAudioFilesToProcessor();
	}
	async handleTB3Select(e) {
		const file = e.target.files[0];
		if(file) {
			editor.showLoading();
			try {
				await this.handleTB3File(file);
				this.updateFileList();
				this.sendAudioFilesToProcessor();
			} finally {
				// Don't hide loading here since handleTB3File -> loadCode will handle it
			}
		}
	}
	async handleTB3File(file) {
		const zip = new JSZip();
		const zipData = await zip.loadAsync(file);
		this.audioFiles.clear();
		
		// Detect format
		let format = 'Unknown';
		const hasAudioFolder = Object.keys(zipData.files).some(f => f.startsWith('audio/'));
		const hasAudioJson = zipData.files['audio.json'];
		
		if(hasAudioFolder) format = 'TB3';
		else if(hasAudioJson) format = 'TB2';
		else format = 'TB3';
		
		// TB2/TB3 format
		if(zipData.files['code.txt'] && zipData.files['settings.json']) {
			const code = await zipData.files['code.txt'].async('string');
			const settings = JSON.parse(await zipData.files['settings.json'].async('string'));
			
			// Don't show loading again since loadCode will handle it
			this.loadCode({ code, ...settings, format }, true);
			
			// TB3: Load from audio folder
			for(const [filename, zipEntry] of Object.entries(zipData.files)) {
				if(filename.startsWith('audio/') && filename.endsWith('.json')) {
					const index = +filename.match(/\/(\d+)\.json$/)[1];
					const audioData = JSON.parse(await zipEntry.async('text'));
					this.audioFiles.set(index, {
						name: audioData.name,
						data: new Float32Array(audioData.data),
						channels: audioData.channels,
						sampleRate: audioData.sampleRate
					});
				}
			}
			
			// TB2: Load from audio.json
			if(zipData.files['audio.json']) {
				const audioData = JSON.parse(await zipData.files['audio.json'].async('string'));
				// TB2 format: data is [sample][channel], interleave channels
				const numChannels = audioData.channels;
				const length = audioData.data.length;
				const interleaved = new Float32Array(length * numChannels);
				for (let i = 0; i < length; i++) {
					for (let ch = 0; ch < numChannels; ch++) {
						interleaved[i * numChannels + ch] = audioData.data[i][ch] || 0;
					}
				}
				this.audioFiles.set(0, {
					name: 'audio.json',
					data: interleaved,
					channels: numChannels,
					sampleRate: audioData.sampleRate
				});
			}
		}
	}
	async handleAudioFile(file) {
		const arrayBuffer = await file.arrayBuffer();
		const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
		const numChannels = audioBuffer.numberOfChannels;
		const length = audioBuffer.length;
		const interleaved = new Float32Array(length * numChannels);
		for (let i = 0; i < length; i++) {
			for (let ch = 0; ch < numChannels; ch++) {
				interleaved[i * numChannels + ch] = audioBuffer.getChannelData(ch)[i];
			}
		}
		const audioData = {
			name: file.name,
			data: interleaved,
			channels: numChannels,
			sampleRate: audioBuffer.sampleRate,
			duration: audioBuffer.duration
		};
		this.audioFiles.set(this.audioFiles.size, audioData);
	}
	updateFileList() {
		const fileList = document.getElementById('file-list') || document.getElementById('audio-list');
		if(!fileList) return;
		fileList.innerHTML = '';
		this.audioFiles.forEach((file, index) => {
			const fileItem = document.createElement('div');
			fileItem.className = 'file-item';
			fileItem.innerHTML = `
				<span>${ index }: ${ file.name }</span>
				<button class="remove-file" data-index="${ index }">×</button>
			`;
			fileItem.querySelector('.remove-file').addEventListener('click', () => {
				this.removeFile(index);
			});
			fileList.appendChild(fileItem);
		});
	}
	removeFile(index) {
		this.audioFiles.delete(index);
		this.updateFileList();
		this.sendAudioFilesToProcessor();
	}
	clearAllFiles() {
		this.audioFiles.clear();
		this.updateFileList();
		this.sendAudioFilesToProcessor();
	}
	sendAudioFilesToProcessor() {
		this.sendData({ audioFiles: Array.from(this.audioFiles.entries()) });
	}
	async loadTB3FromUrl(url) {
		editor.showLoading();
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const file = new File([blob], url.split('/').pop());
			await this.handleTB3File(file);
			this.updateFileList();
			this.sendAudioFilesToProcessor();
		} finally {
			setTimeout(() => editor.hideLoading(), 100);
		}
	}
	async loadExoticProjects() {
		try {
			const response = await fetch('./data/exotic-projects.json');
			const data = await response.json();
			const container = document.getElementById('exotic-projects');
			container.innerHTML = '';
			
			for(const section of data.sections) {
				// Create section header
				const sectionHeader = document.createElement('div');
				sectionHeader.className = 'library-header';
				sectionHeader.innerHTML = `<span class="library-arrow">${
					section.expanded ? '▼' : '▶'
				}</span> ${ section.name } <span class="library-count">${
					section.count
				} songs</span>`;
				container.appendChild(sectionHeader);
				
				// Create projects container
				const projectsContainer = document.createElement('div');
				projectsContainer.className = 'library-songs';
				projectsContainer.style.display = section.expanded ? 'block' : 'none';
				
				for(const project of section.projects) {
					const projectDiv = document.createElement('div');
					projectDiv.className = 'song';
					
					if(project.codeFile.endsWith('.tb2') || project.codeFile.endsWith('.tb3')) {
						// TB2/TB3 project file
						const formatLabel = project.codeFile.endsWith('.tb2') ? '[TB2] ' : '[TB3] ';
						projectDiv.innerHTML = `
							<div class="song-title">${ formatLabel }${
								project.name
							}</div>
							<div class="song-author">${ section.name } (${
								project.date
							})</div>
							${
								project.description
									? `<div class="song-description">${
										project.description
									}</div>`
									: ''
							}
							${
								project.features
									? `<div class="song-features">Features: ${
										project.features.join(', ')
									}</div>`
									: ''
							}
							<button class="code-load" data-file="./data/songs/exotic/${
								project.codeFile
							}">Load ${ project.codeFile }</button>
						`;
					} else {
						// Regular JS file
						const formatLabel = project.mode ? `[${ project.mode }] ` : '';
						if(project.long_code) {
							projectDiv.innerHTML = `
								<div class="song-title">${ formatLabel }${
									project.name
								}</div>
								<div class="song-author">${ section.name } (${
									project.date
								})</div>
								${
									project.description
										? `<div class="song-description">${
											project.description
										}</div>`
										: ''
								}
								${
									project.features
										? `<div class="song-features">Features: ${
											project.features.join(', ')
										}</div>`
										: ''
								}
								<button class="code-load" data-codefile="./data/songs/exotic/${
									project.codeFile
								}" data-songdata='${
									JSON.stringify(project)
								}'>Load ${ project.codeFile }</button>
							`;
						} else {
							const codeResponse = await fetch(`./data/songs/exotic/${ project.codeFile }`);
							const code = await codeResponse.text();
							projectDiv.innerHTML = `
								<div class="song-title">${ formatLabel }${
									project.name
								}</div>
								<div class="song-author">${ section.name } (${
									project.date
								})</div>
								${
									project.description
										? `<div class="song-description">${
											project.description
										}</div>`
										: ''
								}
								${
									project.features
										? `<div class="song-features">Features: ${
											project.features.join(', ')
										}</div>`
										: ''
								}
								<div class="code-text" data-songdata='${
									JSON.stringify({ ...project, code })
								}'>${ code }</div>
							`;
						}
					}
					projectsContainer.appendChild(projectDiv);
				}
				container.appendChild(projectsContainer);
			}
		} catch(error) {
			console.log('No exotic projects file found');
		}
	}
	async saveTB3() {
		const zip = new JSZip();
		const audioFolder = zip.folder('audio');
		
		// Save code
		zip.file('code.txt', editor.value);
		
		// Save settings
		zip.file('settings.json', JSON.stringify({
			mode: this.mode,
			sampleRate: this.sampleRate,
			drawMode: scope.drawMode,
			scale: scope.drawScale,
			fftBinSize: this.settings.fftBinSize
		}));
		
		// Save audio files in audio folder
		for(const [index, audioData] of this.audioFiles.entries()) {
			audioFolder.file(`${ index }.json`, JSON.stringify({
				name: audioData.name,
				data: Array.from(audioData.data),
				channels: audioData.channels,
				sampleRate: audioData.sampleRate
			}));
		}
		
		const blob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(blob);
		ui.downloader.href = url;
		ui.downloader.download = 'project.tb3';
		ui.downloader.click();
		setTimeout(() => URL.revokeObjectURL(url));
	}
	getOfflineExportElements() {
		return {
			start: document.getElementById('offline-render-start'),
			duration: document.getElementById('offline-render-duration'),
			units: document.getElementById('offline-render-units'),
			button: document.getElementById('offline-render-wav'),
			status: document.getElementById('offline-render-status')
		};
	}
	setOfflineStatus(message, isError = false) {
		const { status } = this.getOfflineExportElements();
		if(!status) {
			return;
		}
		status.textContent = message;
		status.style.color = isError ? '#ffb2b2' : '#b8c4d8';
	}
	createBytebeatFunction(codeText, mode) {
		const params = Object.getOwnPropertyNames(Math);
		const values = params.map(k => Math[k]);
		const funcs = {
			/*bit*/        "bitC": function (x, y, z) { return x & y ? z : 0 },
			/*bit reverse*/"br": function (x, size = 8) {
				if (size > 32) { throw new Error("br() Size cannot be greater than 32"); }
				let result = 0;
				for (let idx = 0; idx < size; idx++) {
					result += funcs.bitC(x, 2 ** idx, 2 ** (size - (idx + 1)));
				}
				return result;
			},
			/*sin that loops every 128 "steps", instead of every pi steps*/"sinf": function (x) { return Math.sin(x / (128 / Math.PI)); },
			/*cos that loops every 128 "steps", instead of every pi steps*/"cosf": function (x) { return Math.cos(x / (128 / Math.PI)); },
			/*tan that loops every 128 "steps", instead of every pi steps*/"tanf": function (x) { return Math.tan(x / (128 / Math.PI)); },
			/*converts t into a string composed of it's bits, regex's that*/"regG": function (t, X) { return X.test(t.toString(2)); },
			"saw": t => t % 256,
			"tri": t => Math.abs((t % 512) - 256),
			"sq": t => t % 256 < 128 ? 255 : 0,
			"audioIN": (index, channel = 0, file = 0) => {
				const audioFile = this.audioFiles.get(file);
				if (!audioFile || !audioFile.data) return 0;
				const sampleIndex = Math.floor(index) * audioFile.channels + (channel % audioFile.channels);
				return audioFile.data[sampleIndex] || 0;
			},
			"audioLength": (file = 0) => {
				const audioFile = this.audioFiles.get(file);
				return audioFile ? audioFile.data.length / audioFile.channels : 0;
			}
		};

		params.push('int', 'window', ...Object.keys(funcs));
		values.push(Math.floor, globalThis, ...Object.values(funcs));

		if(mode === 'Funcbeat') {
			const factory = new Function(...params, codeText).bind(globalThis, ...values);
			const fn = factory();
			if(typeof fn !== 'function') {
				throw new Error('Funcbeat must return a function.');
			}
			fn(0, this.sampleRate);
			return { fn, isFuncbeat: true };
		}

		let compiledCode = (codeText || '').trim().replace(
			/^eval\(unescape\(escape(?:`|\('|\("|\(`)(.*?)(?:`|'\)|"\)|`\)).replace\(\/u\(\.\.\)\/g,["'`]\$1%["'`]\)\)\)$/,
			(match, m1) => unescape(escape(m1).replace(/u(..)/g, '$1%'))
		);
		const fn = new Function(...params, 't', `return 0,\n${ compiledCode || 0 };`)
			.bind(globalThis, ...values);
		fn(0);
		return { fn, isFuncbeat: false };
	}
	getOutputValue(value, mode) {
		switch(mode) {
		case 'Bytebeat':
			return (value & 255) / 127.5 - 1;
		case 'Signed Bytebeat':
			return ((value + 128) & 255) / 127.5 - 1;
		case 'Bitbeat':
			return (value & 1) - 0.5;
		case '2048':
			return (value & 2047) / 1020 - 1;
		case 'logmode':
			return ((Math.log2(value) * 32) & 255) / 127.5 - 1;
		case 'logHack': {
			const neg = (value < 0) ? -32 : 32;
			return ((Math.log2(Math.abs(value)) * neg) & 255) / 127.5 - 1;
		}
		case 'logHack2': {
			const neg = value < 0;
			return value === 0 ? 0 :
				((((Math.log2(Math.abs(value)) * (neg ? -16 : 16)) + (neg ? -127 : 128)) & 255) / 127.5 - 1);
		}
		case 'Floatbeat':
		case 'Funcbeat':
		default: {
			const outValue = Math.max(Math.min(value, 1), -1);
			return outValue;
		}
		}
	}
	encodeWav(buffer) {
		const numChannels = buffer.numberOfChannels;
		const sampleRate = buffer.sampleRate;
		const numFrames = buffer.length;
		const bytesPerSample = 2;
		const blockAlign = numChannels * bytesPerSample;
		const byteRate = sampleRate * blockAlign;
		const dataSize = numFrames * blockAlign;
		const bufferSize = 44 + dataSize;
		const arrayBuffer = new ArrayBuffer(bufferSize);
		const view = new DataView(arrayBuffer);
		const writeString = (offset, str) => {
			for(let i = 0; i < str.length; i++) {
				view.setUint8(offset + i, str.charCodeAt(i));
			}
		};
		writeString(0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, numChannels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, byteRate, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, 16, true);
		writeString(36, 'data');
		view.setUint32(40, dataSize, true);
		let offset = 44;
		const channelData = [];
		for(let ch = 0; ch < numChannels; ch++) {
			channelData.push(buffer.getChannelData(ch));
		}
		for(let i = 0; i < numFrames; i++) {
			for(let ch = 0; ch < numChannels; ch++) {
				let sample = channelData[ch][i];
				sample = Math.max(-1, Math.min(1, sample));
				view.setInt16(offset, Math.round(sample * 32767), true);
				offset += 2;
			}
		}
		return new Blob([arrayBuffer], { type: 'audio/wav' });
	}
	async renderOfflineWav() {
		const { start, duration, units, button } = this.getOfflineExportElements();
		if(!start || !duration || !units || !button) {
			return;
		}
		const startValue = parseFloat(start.value);
		const durationValue = parseFloat(duration.value);
		if(!isFinite(startValue) || startValue < 0) {
			this.setOfflineStatus('Start must be 0 or greater.', true);
			return;
		}
		if(!isFinite(durationValue) || durationValue <= 0) {
			this.setOfflineStatus('Duration must be greater than 0.', true);
			return;
		}
		if(this.isOfflineRendering) {
			return;
		}
		this.isOfflineRendering = true;
		button.setAttribute('disabled', true);
		this.setOfflineStatus('Rendering...');
		try {
			const sampleRate = this.sampleRate;
			const useFrames = units.value === 'frames';
			const startSample = useFrames ?
				Math.max(0, Math.floor(startValue)) :
				Math.max(0, Math.round(startValue * sampleRate));
			const renderSamples = useFrames ?
				Math.max(1, Math.floor(durationValue)) :
				Math.max(1, Math.round(durationValue * sampleRate));
			const offlineCtx = new OfflineAudioContext(2, renderSamples, sampleRate);
			const buffer = offlineCtx.createBuffer(2, renderSamples, sampleRate);
			const leftData = buffer.getChannelData(0);
			const rightData = buffer.getChannelData(1);
			const { fn, isFuncbeat } = this.createBytebeatFunction(editor.value, this.mode);
			const srDivisor = Math.max(1, this.settings.srDivisor || 1);
			let lastSample = NaN;
			let divisorStorage = 0;
			let outChannels = [0, 0, 0];
			let outLeft = 0;
			let outRight = 0;
			for(let i = 0; i < renderSamples; i++) {
				const t = startSample + i;
				const currentSample = Math.floor(t);
				const divisorMet = (((t % srDivisor) + srDivisor) % srDivisor) === 0;
				if(currentSample !== lastSample) {
					lastSample = currentSample;
					let funcValue;
					try {
						if(isFuncbeat) {
							funcValue = fn(currentSample / sampleRate, sampleRate);
						} else {
							funcValue = fn(currentSample);
						}
						if(!divisorMet) {
							funcValue = divisorStorage;
						} else {
							divisorStorage = funcValue;
						}
					} catch(err) {
						funcValue = NaN;
					}
					let values;
					let hasCenter = false;
					if(Array.isArray(funcValue)) {
						if(funcValue.length >= 3) {
							values = [funcValue[0], funcValue[1], funcValue[2]];
							hasCenter = true;
						} else if(funcValue.length === 2) {
							values = [funcValue[0], NaN, funcValue[1]];
						} else if(funcValue.length === 1) {
							values = [funcValue[0], NaN, funcValue[0]];
						} else {
							values = [NaN, NaN, NaN];
						}
					} else {
						values = [funcValue, NaN, funcValue];
					}
					const channelIndices = hasCenter ? [0, 1, 2] : [0, 2];
					for(const ch of channelIndices) {
						let value = values[ch];
						try {
							value = +value;
						} catch {
							value = NaN;
						}
						if(!isNaN(value)) {
							outChannels[ch] = this.getOutputValue(value, this.mode);
						}
					}
					if(hasCenter) {
						outLeft = outChannels[0] * (2 / 3) + outChannels[1] / 3;
						outRight = outChannels[2] * (2 / 3) + outChannels[1] / 3;
					} else {
						outLeft = outChannels[0];
						outRight = outChannels[2];
					}
				}
				leftData[i] = outLeft;
				rightData[i] = outRight;
			}
			const source = offlineCtx.createBufferSource();
			source.buffer = buffer;
			source.connect(offlineCtx.destination);
			source.start();
			const rendered = await offlineCtx.startRendering();
			const wavBlob = this.encodeWav(rendered);
			const filename = `bytebeat_${ useFrames ? `${ startSample }f_${ renderSamples }f` : `${ (startSample / sampleRate).toFixed(2) }s_${ (renderSamples / sampleRate).toFixed(2) }s` }.wav`;
			const url = URL.createObjectURL(wavBlob);
			ui.downloader.href = url;
			ui.downloader.download = filename;
			ui.downloader.click();
			setTimeout(() => URL.revokeObjectURL(url));
			this.setOfflineStatus('WAV export complete.');
		} catch(err) {
			this.setOfflineStatus(`Render failed: ${ err.message || err }`, true);
		} finally {
			button.removeAttribute('disabled');
			this.isOfflineRendering = false;
		}
	}
	toggleExoticSection(header) {
		const arrow = header.querySelector('.library-arrow');
		const songsContainer = header.nextElementSibling;
		const isExpanded = songsContainer.style.display !== 'none';
		arrow.textContent = isExpanded ? '▶' : '▼';
		songsContainer.style.display = isExpanded ? 'none' : 'block';
	}
	loadCode(params = {}, isPlay = true) {
		let { code, sampleRate, inputMode, mode: paramMode, drawMode, scale, fftBinSize, srDivisor: paramSrDivisor } = params;
		if(drawMode === 'FFT_1024') {
			drawMode = 'FFT';
		}
		let mode = inputMode || paramMode || this.mode || 'Bytebeat';
		if (mode === '') mode = 'Bytebeat';
		const savedSrDivisor = paramSrDivisor !== undefined ? paramSrDivisor : (this.settings.srDivisor || 1);
		
		// Show loading overlay
		editor.showLoading();
		
		// Use setTimeout to allow the loading overlay to show before processing
		setTimeout(() => {
			this.mode = ui.controlPlaybackMode.value = mode;
			editor.setValue(code || editor.value);
			this.setSampleRate(ui.controlSampleRate.value = +sampleRate || 8000, false);
			
			// Set UI and send saved/parameter srDivisor
			ui.controlSRDivisor.textContent = savedSrDivisor;
			const data = {
				mode,
				sampleRate: this.sampleRate,
				sampleRatio: this.sampleRate / this.audioCtx.sampleRate,
				srDivisor: savedSrDivisor
			};
			if(isPlay) {
				data.playbackSpeed = this.playbackSpeed = 1;
				this.playbackToggle(true, false);
				data.resetTime = true;
				data.isPlaying = isPlay;
			}
			data.setFunction = code || editor.value;
			
			// Check if scope preferences should not be changed
			const doNotChangeScopePrefs = this.settings.donotChangeScopePreferences;
			
			if(drawMode && !doNotChangeScopePrefs) {
				ui.controlDrawMode.value = scope.drawMode = drawMode;
				this.saveSettings();
			}
			if(scale !== undefined && !doNotChangeScopePrefs) {
				this.setScale(scale - scope.drawScale);
			}
			if(fftBinSize !== undefined && !doNotChangeScopePrefs) {
				this.setFftBinSize(fftBinSize);
			}
			this.sendData(data);
			
			// Hide loading overlay after a short delay
			setTimeout(() => {
				editor.hideLoading();
			}, 100);
		}, 10);
	}
	oninputCounter(e) {
		if(e.key === 'Enter') {
			ui.controlTime.blur();
			this.playbackToggle(true);
			return;
		}
		const { value } = ui.controlTime;
		const byteSample = this.settings.isSeconds ? Math.round(value * this.sampleRate) : value;
		this.setByteSample(byteSample);
		this.sendData({ byteSample });
	}
	parseUrl() {
		let urlHash = window.location.hash;
		if(!urlHash) {
			this.updateUrl();
			urlHash = window.location.hash;
		}
		const codeData = getCodeFromUrl(urlHash) || { code: editor.value };
		const savedSrDivisor = this.settings.srDivisor || 1;
		ui.controlSRDivisor.textContent = savedSrDivisor;
		// Only show loading if we're loading code from URL (not default)
		if(urlHash && getCodeFromUrl(urlHash)) {
			this.loadCode({ ...codeData, srDivisor: savedSrDivisor }, false);
		} else {
			// For default code, don't show loading overlay
			this.loadCode({ ...codeData, srDivisor: savedSrDivisor }, false);
		}
	}
	playbackStop() {
		this.playbackToggle(false, false);
		this.sendData({ isPlaying: false, resetTime: true });
	}
	playbackToggle(isPlaying, isSendData = true, speedIncrement = 0) {
		const isReverse = speedIncrement ? speedIncrement < 0 : this.playbackSpeed < 0;
		const buttonElem = isReverse ? ui.controlPlayBackward : ui.controlPlayForward;
		if(speedIncrement && buttonElem.getAttribute('disabled')) {
			return;
		}
		const multiplierElem = buttonElem.firstElementChild;
		const speed = speedIncrement ? +multiplierElem.textContent : 1;
		multiplierElem.classList.toggle('control-fast-multiplier-large', speed >= 8);
		const nextSpeed = speed === 64 ? 0 : speed * 2;
		ui.setPlayButton(ui.controlPlayBackward, isPlaying && isReverse ? nextSpeed : 1);
		ui.setPlayButton(ui.controlPlayForward, isPlaying && !isReverse ? nextSpeed : 1);
		if(speedIncrement || !isPlaying) {
			this.playbackSpeed = isPlaying ? speedIncrement * speed : Math.sign(this.playbackSpeed);
		}
		scope.canvasContainer.title = isPlaying ? `Click to ${
			this.isRecording ? 'pause and stop recording' : 'pause' }` :
			`Click to play${ isReverse ? ' in reverse' : '' }`;
		scope.canvasPlayButton.classList.toggle('canvas-play-backward', isReverse);
		scope.canvasPlayButton.classList.toggle('canvas-play', !isPlaying);
		scope.canvasPlayButton.classList.toggle('canvas-pause', isPlaying);
		if(isPlaying) {
			scope.canvasPlayButton.classList.remove('canvas-initial');
			if(this.audioCtx.resume) {
				this.audioCtx.resume();
				scope.requestAnimationFrame(); // Main call for drawing in the scope
			}
		} else {
			if(this.isRecording) {
				this.isRecording = false;
				ui.controlRecord.classList.remove('control-recording');
				ui.controlRecord.title = 'Record to file';
				this.audioRecorder.stop();
			}
		}
		this.isPlaying = isPlaying;
		if(isSendData) {
			this.sendData({ isPlaying, playbackSpeed: this.playbackSpeed });
		} else {
			this.isNeedClear = true;
		}
	}
	receiveData(data) {
		const { byteSample, drawBuffer, error } = data; // fftData unused
		if(typeof byteSample === 'number') {
			this.setCounterValue(byteSample);
			this.setByteSample(byteSample);
		}
		if(Array.isArray(drawBuffer)) {
			scope.drawBuffer = scope.drawBuffer.concat(drawBuffer);
			const limit = scope.canvasWidth * (1 << scope.drawScale) - 1;
			if(scope.drawBuffer.length > limit) {
				scope.drawBuffer = scope.drawBuffer.slice(-limit);
			}
		}

		if(error !== undefined) {
			let isUpdate = false;
			if(error.isCompiled === false) {
				isUpdate = true;
				this.isCompilationError = true;
			} else if(error.isCompiled === true) {
				isUpdate = true;
				this.isCompilationError = false;
			} else if(error.isRuntime === true && !this.isCompilationError) {
				isUpdate = true;
			}
			if(isUpdate) {
				editor.errorElem.innerText = error.message;
				// Also update the floating error console if it's visible
				const errorConsole = document.getElementById('error-console');
				if(errorConsole && !errorConsole.classList.contains('hidden')) {
					errorConsole.innerText = error.message;
				}
				this.sendData({ errorDisplayed: true });
			}
			if(data.updateUrl !== true) {
				ui.setCodeSize(editor.value);
			}
		}
		if(data.updateUrl === true) {
			this.updateUrl();
		}
	}
	resetTime() {
		this.isNeedClear = true;
		this.sendData({ resetTime: true, playbackSpeed: this.playbackSpeed });
	}
	saveSettings() {
		this.settings.drawMode = scope.drawMode;
		this.settings.drawScale = scope.drawScale;
		this.settings.showAllSongs = library.showAllSongs;
		localStorage.settings = JSON.stringify(this.settings);
	}
	sendData(data) {
		this.audioWorkletNode.port.postMessage(data);
		if(this.fftWorkletNode) {
			this.fftWorkletNode.port.postMessage({
				...data,
				fftRawOutput: true
			});
		}
	}
	setByteSample(value) {
		this.byteSample = +value || 0;
		if(this.isNeedClear && value === 0) {
			this.isNeedClear = false;
			scope.drawBuffer = [];
			scope.clearCanvas();
			scope.canvasTimeCursor.style.left = 0;
			if(!this.isPlaying) {
				scope.canvasPlayButton.classList.add('canvas-initial');
			}
		}
	}
	setCodeStyle(value) {
		if(value === undefined) {
			if((value = this.settings.codeStyle) === undefined) {
				value = this.settings.codeStyle = this.defaultSettings.codeStyle;
				this.saveSettings();
			}
			editor.container.dataset.theme = value;
			return;
		}
		editor.container.dataset.theme = this.settings.codeStyle = value;
		this.saveSettings();
	}
	sanitizeAudioCtxSampleRate(value) {
		if(!value || !isFinite(value)) {
			return undefined;
		}
		const rounded = Math.round(Math.abs(value));
		if(rounded < 8000) {
			return 8000;
		}
		return rounded;
	}
	async setAudioCtxSampleRate(value) {
		const desired = this.sanitizeAudioCtxSampleRate(value);
		const stored = this.sanitizeAudioCtxSampleRate(this.settings.audioCtxSampleRate);
		if(desired === stored) {
			return;
		}
		this.settings.audioCtxSampleRate = desired || 48000;
		this.saveSettings();
		if(!this.audioCtx) {
			return;
		}
		await this.reinitAudioContext();
	}
	async setExtraFftChannels(isEnabled) {
		const next = !!isEnabled;
		if(next === !!this.settings.showExtraFftChannels) {
			return;
		}
		if(this.settings.fftBinSize === undefined) {
			this.settings.fftBinSize = scope.fftBinSize || this.defaultSettings.fftBinSize;
		}
		this.settings.showExtraFftChannels = next;
		this.saveSettings();
		await this.reinitAudioContext();
	}
	setMonoFft(isEnabled) {
		this.settings.showMonoFft = !!isEnabled;
		scope.showMonoFft = this.settings.showMonoFft;
		this.saveSettings();
	}
	setFftFill(isEnabled) {
		this.settings.showFftFill = !!isEnabled;
		scope.showFftFill = this.settings.showFftFill;
		this.saveSettings();
	}
	setFftBlendMode(mode) {
		this.settings.fftBlendMode = mode || 'source-over';
		scope.fftBlendMode = this.settings.fftBlendMode;
		this.saveSettings();
	}
	async reinitAudioContext() {
		const wasPlaying = this.isPlaying;
		this.playbackToggle(false, false);
		if(this.audioWorkletNode) {
			try { this.audioWorkletNode.disconnect(); } catch { /* noop */ }
		}
		if(this.fftWorkletNode) {
			try { this.fftWorkletNode.disconnect(); } catch { /* noop */ }
		}
		if(this.audioGain) {
			try { this.audioGain.disconnect(); } catch { /* noop */ }
		}
		if(this.analyserGain) {
			try { this.analyserGain.disconnect(); } catch { /* noop */ }
		}
		if(this.audioCtx) {
			try { await this.audioCtx.close(); } catch { /* noop */ }
		}
		await this.initAudio();
		const data = {
			mode: this.mode,
			sampleRate: this.sampleRate,
			sampleRatio: this.sampleRate / this.audioCtx.sampleRate,
			srDivisor: this.settings.srDivisor || 1,
			drawMode: scope.drawMode,
			setFunction: editor.value,
			isPlaying: false,
			playbackSpeed: this.playbackSpeed
		};
		this.sendData(data);
		if(wasPlaying) {
			this.playbackToggle(true);
		}
	}
	parseHexColor(value) {
		if(typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
			return [255, 255, 255];
		}
		return [
			parseInt(value.slice(1, 3), 16),
			parseInt(value.slice(3, 5), 16),
			parseInt(value.slice(5, 7), 16)
		];
	}
	toHexColor(rgb) {
		const toHex = value => value.toString(16).padStart(2, '0');
		return `#${ toHex(rgb[0]) }${ toHex(rgb[1]) }${ toHex(rgb[2]) }`;
	}
	mapStereoColors(baseHex, stereo) {
		const [r, g, b] = this.parseHexColor(baseHex);
		let left;
		let right;
		switch(stereo) {
		case 0:
			left = [r, 0, 0];
			right = [0, g, b];
			break;
		case 2:
			left = [0, 0, b];
			right = [r, g, 0];
			break;
		default:
			left = [0, g, 0];
			right = [r, 0, b];
		}
		return {
			left: this.toHexColor(left),
			center: this.toHexColor([r, g, b]),
			right: this.toHexColor(right)
		};
	}
	ensureColorSettings() {
		const hasWaveform = this.settings.colorWaveformLeft !== undefined ||
			this.settings.colorWaveformCenter !== undefined ||
			this.settings.colorWaveformMono !== undefined ||
			this.settings.colorWaveformRight !== undefined;
		const hasDiagram = this.settings.colorDiagramLeft !== undefined ||
			this.settings.colorDiagramCenter !== undefined ||
			this.settings.colorDiagramMono !== undefined ||
			this.settings.colorDiagramRight !== undefined;
		if(!hasWaveform || !hasDiagram) {
			const baseWaveform = this.settings.colorWaveform || this.defaultSettings.colorWaveformCenter || '#ffffff';
			const baseDiagram = this.settings.colorDiagram || this.defaultSettings.colorDiagramCenter || '#0080ff';
			const stereo = this.settings.colorStereo ?? 1;
			const waveformColors = this.mapStereoColors(baseWaveform, stereo);
			const diagramColors = this.mapStereoColors(baseDiagram, stereo);
			if(this.settings.colorWaveformLeft === undefined) {
				this.settings.colorWaveformLeft = waveformColors.left;
			}
			if(this.settings.colorWaveformCenter === undefined) {
				this.settings.colorWaveformCenter = waveformColors.center;
			}
			if(this.settings.colorWaveformMono === undefined) {
				this.settings.colorWaveformMono = waveformColors.center;
			}
			if(this.settings.colorWaveformRight === undefined) {
				this.settings.colorWaveformRight = waveformColors.right;
			}
			if(this.settings.colorDiagramLeft === undefined) {
				this.settings.colorDiagramLeft = diagramColors.left;
			}
			if(this.settings.colorDiagramCenter === undefined) {
				this.settings.colorDiagramCenter = diagramColors.center;
			}
			if(this.settings.colorDiagramMono === undefined) {
				this.settings.colorDiagramMono = diagramColors.center;
			}
			if(this.settings.colorDiagramRight === undefined) {
				this.settings.colorDiagramRight = diagramColors.right;
			}
		}
		delete this.settings.colorStereo;
		delete this.settings.colorDiagram;
		delete this.settings.colorWaveform;
		this.saveSettings();
	}
	setColorDiagramLeft(value) {
		if(value !== undefined) {
			this.settings.colorDiagramLeft = value;
			this.saveSettings();
		} else if((value = this.settings.colorDiagramLeft) === undefined) {
			value = this.settings.colorDiagramLeft = this.defaultSettings.colorDiagramLeft;
			this.saveSettings();
		}
		ui.controlColorDiagramLeft.value = value;
		scope.colorDiagramLeft = this.parseHexColor(value);
	}
	setColorDiagramCenter(value) {
		if(value !== undefined) {
			this.settings.colorDiagramCenter = value;
			this.saveSettings();
		} else if((value = this.settings.colorDiagramCenter) === undefined) {
			value = this.settings.colorDiagramCenter = this.defaultSettings.colorDiagramCenter;
			this.saveSettings();
		}
		ui.controlColorDiagramCenter.value = value;
		scope.colorDiagramCenter = this.parseHexColor(value);
	}
	setColorDiagramMono(value) {
		if(value !== undefined) {
			this.settings.colorDiagramMono = value;
			this.saveSettings();
		} else if((value = this.settings.colorDiagramMono) === undefined) {
			value = this.settings.colorDiagramMono = this.defaultSettings.colorDiagramMono;
			this.saveSettings();
		}
		ui.controlColorDiagramMono.value = value;
		scope.colorDiagramMono = this.parseHexColor(value);
	}
	setColorDiagramRight(value) {
		if(value !== undefined) {
			this.settings.colorDiagramRight = value;
			this.saveSettings();
		} else if((value = this.settings.colorDiagramRight) === undefined) {
			value = this.settings.colorDiagramRight = this.defaultSettings.colorDiagramRight;
			this.saveSettings();
		}
		ui.controlColorDiagramRight.value = value;
		scope.colorDiagramRight = this.parseHexColor(value);
	}
	setColorTimeCursor(value) {
		if(value !== undefined) {
			this.settings.colorTimeCursor = value;
			this.saveSettings();
		} else if((value = this.settings.colorTimeCursor) === undefined) {
			value = this.settings.colorTimeCursor = this.defaultSettings.colorTimeCursor;
			this.saveSettings();
		}
		ui.controlColorTimeCursor.value = value;
		scope.canvasTimeCursor.style.borderLeft = '2px solid ' + value;
	}
	setColorWaveformLeft(value) {
		if(value !== undefined) {
			this.settings.colorWaveformLeft = value;
			this.saveSettings();
		} else if((value = this.settings.colorWaveformLeft) === undefined) {
			value = this.settings.colorWaveformLeft = this.defaultSettings.colorWaveformLeft;
			this.saveSettings();
		}
		ui.controlColorWaveformLeft.value = value;
		scope.colorWaveformLeft = this.parseHexColor(value);
	}
	setColorWaveformCenter(value) {
		if(value !== undefined) {
			this.settings.colorWaveformCenter = value;
			this.saveSettings();
		} else if((value = this.settings.colorWaveformCenter) === undefined) {
			value = this.settings.colorWaveformCenter = this.defaultSettings.colorWaveformCenter;
			this.saveSettings();
		}
		ui.controlColorWaveformCenter.value = value;
		scope.colorWaveformCenter = this.parseHexColor(value);
	}
	setColorWaveformMono(value) {
		if(value !== undefined) {
			this.settings.colorWaveformMono = value;
			this.saveSettings();
		} else if((value = this.settings.colorWaveformMono) === undefined) {
			value = this.settings.colorWaveformMono = this.defaultSettings.colorWaveformMono;
			this.saveSettings();
		}
		ui.controlColorWaveformMono.value = value;
		scope.colorWaveformMono = this.parseHexColor(value);
	}
	setColorWaveformRight(value) {
		if(value !== undefined) {
			this.settings.colorWaveformRight = value;
			this.saveSettings();
		} else if((value = this.settings.colorWaveformRight) === undefined) {
			value = this.settings.colorWaveformRight = this.defaultSettings.colorWaveformRight;
			this.saveSettings();
		}
		ui.controlColorWaveformRight.value = value;
		scope.colorWaveformRight = this.parseHexColor(value);
	}
	setCounterUnits() {
		ui.controlTimeUnits.textContent = this.settings.isSeconds ? 'sec' : 't';
		this.setCounterValue(this.byteSample);
	}
	setCounterValue(value) {
		ui.controlTime.value = this.settings.isSeconds ? (value / this.sampleRate).toFixed(2) : value;
	}
	setDrawMode(drawMode) {
		scope.drawMode = drawMode;
		this.saveSettings();
		this.sendData({ drawMode });
		this.updateScaleDisplay();
	}
	setPlaybackMode(mode) {
		this.mode = mode;
		this.updateUrl();
		this.sendData({ mode });
	}
	setSampleRate(sampleRate, isSendData = true) {
		const useCtx = sampleRate === 'ctx';
		if(useCtx) {
			sampleRate = this.audioCtx?.sampleRate || 8000;
		}
		if(!sampleRate || !isFinite(sampleRate) ||
			// Float32 limit
			(sampleRate = Number(parseFloat(Math.abs(sampleRate)).toFixed(3))) > 3.4028234663852886E+38
		) {
			sampleRate = 8000;
		}
		if(useCtx) {
			ui.controlSampleRateSelect.value = 'ctx';
		} else {
			switch(sampleRate) {
			case 1000:
			case 8000:
			case 11025:
			case 16000:
			case 22050:
			case 32000:
			case 44100:
			case 48000: ui.controlSampleRateSelect.value = sampleRate; break;
			default: ui.controlSampleRateSelect.selectedIndex = -1;
			}
		}
		ui.controlSampleRate.value = this.sampleRate = sampleRate;
		ui.controlSampleRate.blur();
		ui.controlSampleRateSelect.blur();
		scope.toggleTimeCursor();
		if(isSendData) {
			this.updateUrl();
			this.sendData({
				sampleRate: this.sampleRate,
				sampleRatio: this.sampleRate / this.audioCtx.sampleRate
			});
		}
	}
	setAudioCtxBufferSize(value) {
		const desired = this.sanitizeAudioCtxBufferSize(value);
		const stored = this.sanitizeAudioCtxBufferSize(this.settings.audioCtxBufferSize);
		if(desired === stored) {
			return;
		}
		this.settings.audioCtxBufferSize = desired || 0;
		this.saveSettings();
		if(!this.audioCtx) {
			return;
		}
		this.reinitAudioContext();
	}
	sanitizeAudioCtxBufferSize(value) {
		if(!value || !isFinite(value)) {
			return 0;
		}
		const rounded = Math.round(Math.abs(value));
		if(rounded < 128) {
			return 128;
		}
		return rounded;
	}
	setScale(amount, buttonElem) {
		if(buttonElem?.getAttribute('disabled')) {
			return;
		}
		if(scope.drawMode === 'FFT') {
			if(amount === 0) {
				this.setFftBinSize(this.defaultSettings.fftBinSize || 1024);
				this.updateScaleDisplay();
				return;
			}
			const next = this.clampFftBinSize((scope.fftBinSize || 1024) * (amount > 0 ? 2 : 0.5));
			this.setFftBinSize(next);
		} else {
			const scale = Math.max(scope.drawScale + amount, 0);
			scope.drawScale = scale;
			this.saveSettings();
			scope.clearCanvas();
			scope.toggleTimeCursor();
			if(scope.drawScale <= 0) {
				ui.controlScaleDown.setAttribute('disabled', true);
			} else {
				ui.controlScaleDown.removeAttribute('disabled');
			}
		}
		this.updateScaleDisplay();
	}
	updateScaleDisplay() {
		if(scope.drawMode === 'FFT') {
			const size = scope.fftBinSize || 1024;
			if(ui.controlScaleDown) {
				ui.controlScaleDown.title = 'Add bins';
			}
			if(ui.controlScaleUp) {
				ui.controlScaleUp.title = 'Remove bins';
			}
			ui.controlScale.innerHTML = size <= 512 ? `${ size }` : `<sub>2</sub>${ Math.round(Math.log2(size)) }`;
			if(size >= 2 ** 15) {
				ui.controlScaleDown.setAttribute('disabled', true);
			} else {
				ui.controlScaleDown.removeAttribute('disabled');
			}
			if(ui.controlScaleUp) {
				if(size <= 64) {
					ui.controlScaleUp.setAttribute('disabled', true);
				} else {
					ui.controlScaleUp.removeAttribute('disabled');
				}
			}
		} else {
			const scale = scope.drawScale;
			if(ui.controlScaleDown) {
				ui.controlScaleDown.title = 'Zoom in the scope';
			}
			if(ui.controlScaleUp) {
				ui.controlScaleUp.title = 'Zoom out the scope';
			}
			ui.controlScale.innerHTML = !scale ? '1x' :
				scale < 7 ? `1/${ 2 ** scale }${ scale < 4 ? 'x' : '' }` :
				`<sub>2</sub>-${ scale }`;
			if(scale <= 0) {
				ui.controlScaleDown.setAttribute('disabled', true);
			} else {
				ui.controlScaleDown.removeAttribute('disabled');
			}
			if(ui.controlScaleUp) {
				ui.controlScaleUp.removeAttribute('disabled');
			}
		}
	}
	clampFftBinSize(value) {
		const min = 64;
		const max = 2 ** 15;
		let size = Math.round(value);
		size = Math.max(min, Math.min(max, size));
		const power = Math.round(Math.log2(size));
		return 2 ** power;
	}
	applyFftBinSize(size) {
		const clamped = this.clampFftBinSize(size);
		scope.fftBinSize = clamped;
		if(scope.analyser) {
			scope.analyser.fftSize = clamped;
			scope.analyserData = new Uint8Array(scope.analyser.frequencyBinCount);
		}
		if(scope.analyserLeft) {
			scope.analyserLeft.fftSize = clamped;
			scope.analyserLeftData = new Uint8Array(scope.analyserLeft.frequencyBinCount);
		}
		if(scope.analyserCenter) {
			scope.analyserCenter.fftSize = clamped;
			scope.analyserCenterData = new Uint8Array(scope.analyserCenter.frequencyBinCount);
		}
		if(scope.analyserRight) {
			scope.analyserRight.fftSize = clamped;
			scope.analyserRightData = new Uint8Array(scope.analyserRight.frequencyBinCount);
		}
	}
	setFftBinSize(size) {
		this.applyFftBinSize(size);
		this.settings.fftBinSize = scope.fftBinSize;
		this.saveSettings();
		this.updateScaleDisplay();
	}
	setSRDivisor(increment) {
		const oldValue = this.settings.srDivisor || 1;
		let value = oldValue + increment;
		value = Math.max(1, value); // Prevent 0 or negative
		if(value === oldValue) {
			return;
		}
		// Update UI immediately
		ui.controlSRDivisor.textContent = value;
		this.settings.srDivisor = value;
		this.saveSettings();
		this.sendData({ srDivisor: value });
	}
	setThemeStyle(value) {
		if(value === undefined) {
			if((value = this.settings.themeStyle) === undefined) {
				value = this.settings.themeStyle = this.defaultSettings.themeStyle;
				this.saveSettings();
			}
			document.documentElement.dataset.theme = value;
			return;
		}
		document.documentElement.dataset.theme = this.settings.themeStyle = value;
		let colorCursor, colorDiagram;
		let colorStereo = 1; // Red=0, Green=1, Blue=2
		switch(value) {
		case 'Cake':
			colorCursor = '#40ffff';
			colorDiagram = '#ff00ff';
			colorStereo = 0;
			break;
		case 'Green':
			colorCursor = '#ff0000';
			colorDiagram = '#00c080';
			break;
		case 'Orange':
			colorCursor = '#ffff80';
			colorDiagram = '#8000ff';
			colorStereo = 0;
			break;
		case 'Purple':
			colorCursor = '#ff50ff';
			colorDiagram = '#a040ff';
			colorStereo = 0;
			break;
		case 'Teal':
			colorCursor = '#80c0ff';
			colorDiagram = '#00ffff';
			break;
		default:
			colorCursor = '#00FFFF';
			colorDiagram = '#00a0ff';
		}
		this.setColorTimeCursor(colorCursor);
		const diagramColors = this.mapStereoColors(colorDiagram, colorStereo);
		this.setColorDiagramLeft(diagramColors.left);
		this.setColorDiagramCenter(diagramColors.center);
		this.setColorDiagramRight(diagramColors.right);
	}
	setVolume(isInit) {
		let volumeValue = NaN;
		if(isInit) {
			volumeValue = parseFloat(this.settings.volume);
		}
		if(isNaN(volumeValue)) {
			volumeValue = ui.controlVolume.value / ui.controlVolume.max;
		}
		ui.controlVolume.value = this.settings.volume = volumeValue;
		ui.controlVolume.title = `Volume: ${ (volumeValue * 100).toFixed(2) }%`;
		this.saveSettings();
		this.audioGain.gain.value = volumeValue * volumeValue;
	}
	toggleCounterUnits() {
		this.settings.isSeconds = !this.settings.isSeconds;
		this.saveSettings();
		this.setCounterUnits();
	}
	toggleRecording() {
		if(!this.audioCtx) {
			return;
		}
		if(this.isRecording) {
			this.playbackToggle(false);
			return;
		}
		this.isRecording = true;
		ui.controlRecord.classList.add('control-recording');
		ui.controlRecord.title = 'Pause and stop recording';
		this.audioRecorder.start();
		this.audioRecordChunks = [];
		this.playbackToggle(true);
	}
	updateUrl() {
		const code = editor.value;
		ui.setCodeSize(code);
		getUrlFromCode(code, this.mode, this.sampleRate);
	}
	setScopePreferencesCheckbox() {
		const checkbox = document.getElementById('DONOTCHANGESCOPEPREFERENCES');
		if(checkbox) {
			checkbox.checked = this.settings.donotChangeScopePreferences ?? false;
		}
	}
	setFontFamily(value) {
		if(value === undefined) {
			if((value = this.settings.fontFamily) === undefined) {
				value = this.settings.fontFamily = this.defaultSettings.fontFamily;
				this.saveSettings();
			}
			editor.container.dataset.font = value;
			return;
		}
		editor.container.dataset.font = this.settings.fontFamily = value;
		this.saveSettings();
	}
	setCustomFont(value) {
		if(value === undefined) {
			if((value = this.settings.customFont) === undefined) {
				value = this.settings.customFont = this.defaultSettings.customFont;
				this.saveSettings();
			}
		} else {
			this.settings.customFont = value;
			this.saveSettings();
		}
		if(value && value.includes('http')) {
			document.documentElement.style.setProperty('--custom-font-url', `"${ value }"` );
			const fontName = value.split('family=')[1]?.split('&')[0]?.replace(/\+/g, ' ') || 'monospace';
			document.documentElement.style.setProperty('--custom-font-family', fontName);
		} else {
			document.documentElement.style.setProperty('--custom-font-url', '');
			document.documentElement.style.setProperty('--custom-font-family', value || 'monospace');
		}
	}
	setFontSize(value) {
		if(value === undefined) {
			if((value = this.settings.fontSize) === undefined) {
				value = this.settings.fontSize = this.defaultSettings.fontSize;
				this.saveSettings();
			}
		} else {
			this.settings.fontSize = value;
			this.saveSettings();
		}
		if(editor.container) {
			editor.container.style.fontSize = `calc(10.5pt * ${ value })`;
		}
		if(ui.fontSizeValue) ui.fontSizeValue.textContent = value.toFixed(1) + 'x';
	}
}();

// Add CSS for file management
const style = document.createElement('style');
style.textContent = `
.file-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px;
	margin: 4px 0;
	background: var(--color-bg-secondary);
	border: 1px solid var(--color-border);
	border-radius: 4px;
}
.file-item span {
	flex: 1;
	color: var(--color-text);
}
.remove-file {
	background: #ff4444;
	color: white;
	border: none;
	padding: 4px 8px;
	cursor: pointer;
	border-radius: 3px;
	font-size: 12px;
	margin-left: 8px;
}
.remove-file:hover {
	background: #ff6666;
}
`;
document.head.appendChild(style);
