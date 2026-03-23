import { formatBytes } from './utils.mjs';

export class UI {
	constructor() {
		this.containerFixed = null;
		this.containerScroll = null;
		this.controlCodeSize = null;
		this.controlCodeStyle = null;
		this.controlAudioCtxSampleRate = null;
		this.controlBufferSize = null;
		this.controlFftExtra = null;
		this.controlFftMono = null;
		this.controlFftFill = null;
		this.controlFftBlend = null;
		this.controlFontFamily = null;
		this.controlColorDiagram = null;
		this.controlColorDiagramCenter = null;
		this.controlColorDiagramLeft = null;
		this.controlColorDiagramMono = null;
		this.controlColorDiagramRight = null;
		this.controlColorTimeCursor = null;
		this.controlColorWaveformCenter = null;
		this.controlColorWaveformLeft = null;
		this.controlColorWaveformMono = null;
		this.controlColorWaveformRight = null;
		this.controlDrawMode = null;
		this.controlPlaybackMode = null;
		this.controlPlayBackward = null;
		this.controlPlayForward = null;
		this.controlRecord = null;
		this.controlSampleRate = null;
		this.controlSampleRateSelect = null;
		this.controlScale = null;
		this.controlScaleDown = null;
		this.controlScaleUp = null;
		this.controlThemeStyle = null;
		this.controlTime = null;
		this.controlTimeUnits = null;
		this.controlVolume = null;
		this.mainElem = null;
	}
	copyLink() {
		navigator.clipboard.writeText(window.location);
	}
	expandEditor() {
		this.containerFixed.classList.toggle('container-expanded');
	}
	toggleErrorPosition() {
		const originalError = document.getElementById('error');
		const errorConsole = document.getElementById('error-console');
		const button = document.getElementById('control-error-position');
		
		if (originalError.classList.contains('hidden')) {
			// Show original, hide console
			originalError.classList.remove('hidden');
			errorConsole.classList.add('hidden');
			button.title = 'Move error console to the right';
		} else {
			// Hide original, show console
			originalError.classList.add('hidden');
			errorConsole.classList.remove('hidden');
			// Copy content from original to console
			errorConsole.innerText = originalError.innerText;
			button.title = 'Move error console back to bottom';
		}
	}
	initElements() {
		this.containerFixed = document.getElementById('container-fixed');
		this.containerScroll = document.getElementById('container-scroll');
		this.controlCodeSize = document.getElementById('control-codesize');
		this.controlCodeStyle = document.getElementById('control-code-style');
		this.controlAudioCtxSampleRate = document.getElementById('control-audioctx-samplerate');
		this.controlBufferSize = document.getElementById('control-buffer-size');
		this.controlFftExtra = document.getElementById('control-fft-extra');
		this.controlFftMono = document.getElementById('control-fft-mono');
		this.controlFftFill = document.getElementById('control-fft-fill');
		this.controlFftBlend = document.getElementById('control-fft-blend');
		this.controlFontFamily = document.getElementById('control-font-family');
		this.controlColorDiagramLeft = document.getElementById('control-color-diagram-left');
		this.controlColorDiagramMono = document.getElementById('control-color-diagram-mono');
		this.controlColorDiagramCenter = document.getElementById('control-color-diagram-center');
		this.controlColorDiagramRight = document.getElementById('control-color-diagram-right');
		this.controlColorTimeCursor = document.getElementById('control-color-timecursor');
		this.controlColorWaveformLeft = document.getElementById('control-color-waveform-left');
		this.controlColorWaveformMono = document.getElementById('control-color-waveform-mono');
		this.controlColorWaveformCenter = document.getElementById('control-color-waveform-center');
		this.controlColorWaveformRight = document.getElementById('control-color-waveform-right');
		this.controlDrawMode = document.getElementById('control-drawmode');
		this.controlPlaybackMode = document.getElementById('control-mode');
		this.controlPlayBackward = document.getElementById('control-play-backward');
		this.controlPlayForward = document.getElementById('control-play-forward');
		this.controlRecord = document.getElementById('control-rec');
		this.controlSampleRate = document.getElementById('control-samplerate');
		this.controlSampleRateSelect = document.getElementById('control-samplerate-select');
		this.controlScale = document.getElementById('control-scale');
		this.controlScaleDown = document.getElementById('control-scaledown');
		this.controlScaleUp = document.getElementById('control-scaleup');
		this.controlSRDivisor = document.getElementById('control-srdivisor');
		this.controlSRDivisorUp = document.getElementById('control-srdivisor-up');
		this.controlSRDivisorDown = document.getElementById('control-srdivisor-down');
		this.controlTime = document.getElementById('control-counter');
		this.controlTimeUnits = document.getElementById('control-counter-units');
		this.controlThemeStyle = document.getElementById('control-theme-style');
		this.controlVolume = document.getElementById('control-volume');
		this.downloader = document.getElementById('downloader');
		this.mainElem = document.getElementById('content');
	}
	setCodeSize(value) {
		this.controlCodeSize.textContent = formatBytes(new Blob([value]).size);
	}
	setPlayButton(buttonElem, speed) {
		const isFast = speed !== 1;
		buttonElem.classList.toggle('control-fast', isFast);
		buttonElem.classList.toggle('control-play', !isFast);
		if(speed) {
			buttonElem.firstElementChild.textContent = speed;
			buttonElem.removeAttribute('disabled');
		} else {
			buttonElem.setAttribute('disabled', true);
			buttonElem.removeAttribute('title');
			return;
		}
		const direction = buttonElem === this.controlPlayForward ? 'forward' : 'reverse';
		buttonElem.title = `Play ${ isFast ? `fast ${ direction } x${ speed } speed` : direction }`;
	}
}
