// ─── State Initialization ───────────────────────────────────────────────────

let h = 1;
let i = 0;
let z = [];
let z1 = new Map();   // keyed by id
let z2 = new Map();   // keyed by id
let z3 = new Map();   // keyed by id
let z4 = new Map();   // keyed by id
let z5 = new Map();   // keyed by id
let z4x = new Map();  // keyed by id
let dssData = null;
let dssRead = [];
let dssVoiceCount = 0;
let dssVoice = [];
let dssTime = {};
let dlyVoice = [];
let dlyRead = [];
let callCount = 0;
let h11 = 1;
let i11 = 0;
let dss = new Array(1 << 11).fill(0);
let d = new Array(1).fill(0);

callCount = 0;
h11 = 1;
i11 = 0;

const MAX_BBKEY_STATES = 4096;
const MAX_VOICE_STATES = 256;
const MAX_PER_VOICE_CHORUS = 256;
const MAX_GLOBAL_CHORUS = 256;
const maxDelay = 4096;
const SIZE = 1024;

const bbKeyState = new Map();
const dssVoiceState = new Map();

function lruGetOrCreate(map, key, createFn, maxSize) {
	if (map.has(key)) {
		const value = map.get(key);
		map.delete(key);
		map.set(key, value);
		return value;
	}
	const value = createFn();
	if (map.size >= maxSize) {
		const oldest = map.keys().next().value;
		map.delete(oldest);
	}
	map.set(key, value);
	return value;
}

// ─── Utility Functions ───────────────────────────────────────────────────────
function gen(p11) {
	if (z[h11] === undefined) z[h11] = 0;
	if (z[i11] === undefined) z[i11] = 0;
	z[h11] += p11;
	const result = z[h11 - 2];
	h11 += 2;
	i11 += 2;
	return result;
}

// id: explicit string key identifying this filter instance
function lpf(a, c, id) {
	if (!z1.has(id)) z1.set(id, 0);
	const v = z1.get(id) + (a - z1.get(id)) * c;
	z1.set(id, v);
	return v;
}

// id: explicit string key identifying this filter instance
function hpf(a, c, id) {
	if (!z1.has(id)) z1.set(id, 0);
	const v = z1.get(id) + (a - z1.get(id)) * c;
	z1.set(id, v);
	return a - v;
}

function modPos(n, m) {
	return ((n % m) + m) % m;
};

function createRectangle(h, w, input) {
	const g = Array.from({ length: h }, () => new Array(w).fill(' '));
	for (let c = 0; c < w; c++) {
		const f = Math.max(0, Math.min(input[(c * SIZE / 1024) | 0] | 0, h));
		for (let r = h - 1; r >= h - f; r--) {
			g[r][c] = '█';
		}
	}
	return "\n" + g.map(r => r.join('')).join('\n');
}

function ff(t, c = '█', o = '-', v = '|', a = 64) {
	const arr = Array.from({ length: a }, (_, i) => o.repeat(a - 1 - i) + c).reverse();
	const idx = Math.min(Math.max((t * a / 64) | 0, 0), a - 1);
	return v + arr[idx];
}

// id: explicit string key identifying this rms instance
function rms(a, decayF, id) {
	if (!z5.has(id)) z5.set(id, { var1: 0, var2: 0 });
	const s = z5.get(id);
	s.var1 = (1 - decayF) * s.var1 + decayF * a * a;
	return Math.sqrt(s.var1);
}

function bbRand(i) {
	i /= 256 ** 3;
	let x = (i / 1e8 % 1) * 85345;
	for (let k = 1; k <= 6; k++) {
		x = (x / k * 32598347596 % 1) * 455534532;
		x %= 1;
	}
	return x;
}

// ─── Filter Functions ────────────────────────────────────────────────────────

// id: explicit string key identifying this filter instance
function lp(d, c, res = 0, id) {
	if (!z2.has(id)) z2.set(id, { lp6: 0, lp12: 0 });
	function clamp(minn, maxx, value) { return Math.min(Math.max(value, minn), maxx); }
	const cc = clamp(0, 0.99, c);
	const fb = res + res / (1 - cc);
	const f = d
	const s = z2.get(id);
	s.lp6  += cc * (f - s.lp6  + fb * (s.lp6 - s.lp12));
	s.lp12 += cc * (s.lp6 - s.lp12);
	return s.lp12;
}

// id: explicit string key identifying this filter instance
function hp(d, c, res = 0, id) {
	if (!z3.has(id)) z3.set(id, { hp6: 0, hp12: 0 });
	function clamp(minn, maxx, value) { return Math.min(Math.max(value, minn), maxx); }
	const cc = clamp(0, 0.99, c);
	const fb = res + res / (1 - cc);
	const f = d
	const s = z3.get(id);
	s.hp6  += cc * (f - s.hp6  + fb * (s.hp6 - s.hp12));
	s.hp12 += cc * (s.hp6 - s.hp12);
	return f - s.hp12;
}

// id: explicit string key identifying this filter instance
function bp(d, c, res = 0, id) {
	if (!z4.has(id)) z4.set(id, { bp1: 0, bp2: 0 });
	function clamp(minn, maxx, value) { return Math.min(Math.max(value, minn), maxx); }
	const cc = clamp(0, 0.99, c);
	const fb = res + res / (1 - cc);
	const f = d
	const s = z4.get(id);
	s.bp1 += cc * (f - s.bp1 + fb * (s.bp1 - s.bp2));
	s.bp2 += cc * (s.bp1 - s.bp2);
	return s.bp1 - s.bp2;
}

// id: explicit string key identifying this per-voice BP filter instance
function bbBPVoice(id, d, c, res = 0) {
	if (!z4x.has(id)) z4x.set(id, { bp1: 0, bp2: 0 });
	function clamp(minn, maxx, value) { return Math.min(Math.max(value, minn), maxx); }
	const cc = clamp(0, 0.99, c);
	const fb = res + res / (1 - cc);
	const f = d
	const s = z4x.get(id);
	s.bp1 += cc * (f - s.bp1 + fb * (s.bp1 - s.bp2));
	s.bp2 += cc * (s.bp1 - s.bp2);
	return s.bp1 - s.bp2;
}

function bbGenKey(id, p11) {
	const v = (bbKeyState.get(id) || 0) + p11;
	if (bbKeyState.has(id)) bbKeyState.delete(id);
	bbKeyState.set(id, v);
	if (bbKeyState.size > MAX_BBKEY_STATES) {
		const oldest = bbKeyState.keys().next().value;
		bbKeyState.delete(oldest);
	}
	return v;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

function g(
	c,
	waveSelections,
	peram1,
	peram2,
	volumes,
	filter_select,
	filter_freq,
	filter_res,
	en_del,
	del,
	del_feed,
	pitch_by_speed,
	Glob_en_del,
	Glob_del,
	Glob_del_feed,
	t,
	sr
) {
	if (!Array.isArray(waveSelections)) {
		waveSelections = globalWaveSelections;
	} else if (typeof waveSelections === 'number') {
		waveSelections = new Array(c.length).fill(waveSelections);
	}

	function toArray(val, len, def) {
		if (!Array.isArray(val)) return new Array(len).fill(val !== undefined ? val : def);
		if (typeof val === 'number') return new Array(len).fill(val);
		return val;
	}

	volumes			= toArray(volumes,			c.length, 1);
	peram1			= toArray(peram1,				c.length, 128);
	peram2			= toArray(peram2,				c.length, 128);
	filter_select	= toArray(filter_select,	c.length, 0);
	filter_freq 	= toArray(filter_freq,		c.length, 440);
	filter_res		= toArray(filter_res,		c.length, 1);
	en_del			= toArray(en_del,				c.length, 1);
	del				= toArray(del,					c.length, 1);
	del_feed			= toArray(del_feed,			c.length, 1);
	pitch_by_speed = toArray(pitch_by_speed,	c.length, 1);

	function p(key) {
		return typeof key === 'number' ? Math.pow(2, (key - 9) / 12 - 3) : 0;
	}

	const tf = (1 / sr) * 440 * 256;

	// ─── Wave Functions ───────────────────────────────────────────────────────

	const waveFunctions = {
		saw(key, width, voices, id) {
			return modPos(bbGenKey(id, p(key) * tf), 256);
		},

		Pulse(key, width, voices, id) {
			const phase = bbGenKey(id, p(key) * tf);
			const w = Math.abs((width & 255) - 128);
			return ((((phase ^ phase - w - 128) / 2 & 128) ? w : w + 256));
		},

		triangle(key, width, voices, id) {
			return Math.abs(-1 + (bbGenKey(id, p(key) * tf) / 128) % 2) * 255;
		},

		sine(key, width, voices, id) {
			return (Math.sin(bbGenKey(id, p(key) * tf) * Math.PI / 128) + 1) * 127.5;
		},

		simple_SuperSaw(key, spread, voices = 10, id) {
			voices += 1;
			let e = 0;
			const f = bbGenKey(id, p(key) * tf);
			for (let i = 0; i <= voices; i++) {
				const d = (i / voices) / ((i / voices) + 1) * 5.5 - 1.75;
				e += modPos(f * (1 + d * spread) + d * 1e7, 256);
			}
			return e / (voices + 1);
		},

		and(key, bit, voices, id) {
			return ((bbGenKey(id, p(key) * tf) & bit) & 255) + 128 - (bit & 255) / 2;
		},

		this_thing(key, bit, voices, id) {
			const pitch = p(key) * tf / 127 * Math.PI;
			const res = 1 - 0.005 / Math.max(1, bit);
			const noise = Math.random() * 128;
			// Pass id directly — bbBPVoice now uses the string id
			const out = bbBPVoice(id, noise, pitch, res)
				/ Math.sqrt(pitch)
				* 32 * (1 - res / 1.001);
			return out + 128;
		},

		Nes_triangle(key, width, voices, id) {
			return (Math.abs(-1 + (bbGenKey(id, p(key) * tf) / 128) % 2) * 255) | 15;
		},

		Noise(key, width, voices, id) {
			return bbRand(bbGenKey(id, p(key) * tf) / 16 | 0) * 255;
		},

		Harsh(key, width, voices, id) {
			return bbRand(bbGenKey(id, p(key) * tf) % 256 / 16 | 0) * 255;
		},

		and_2(key, bitPhase, voices, id) {
			const phase = bbGenKey(id, p(key) * tf);
			return (phase & (phase + bitPhase) & 255) - Math.abs((bitPhase & 255) - 128) / 2 + 64;
		},

		xor(key, mul, voices, id) {
			const phase = bbGenKey(id, p(key) * tf) & 255;
			return (phase ^ (phase * mul)) & 255;
		},

		SuperSaw(key, spread, voices = 10, id) {
			voices += 1;
			const baseFreq = p(key) * tf;
			let sum = 0;
			for (let i = 0; i <= voices; i++) {
				const d = Math.sin((i / voices - 0.5) * Math.PI);
				sum += modPos(bbGenKey(id + ":v" + i, baseFreq * (1 + d * spread)) + 1e7 * d, 256);
			}
			return modPos(sum / (voices + 1), 256);
		},

		SawPWM(key, width, voices, id) {
			const phase = modPos(bbGenKey(id, p(key) * tf), 256);
			const pw = (-width & 255);
			return ((phase < pw * 2) ^ (phase < pw * 2 - 256)) ? phase : 0;
		},

		this_dot_thing(key, bit, voices, id) {
			const phase = bbGenKey(id, p(key) * tf);
			const pt = bit * 2;
			return modPos((phase * 6 & pt >> 1) - (phase * (7 - (pt >> 9 & 2)) & pt >> 0), 256);
		},

		this_dot_thing_2(key, bit, voices, id) {
			const phase = bbGenKey(id, p(key) * tf);
			const pt = bit * 2;
			return modPos((phase * 6 & pt >> 0) - (phase * (7 - (pt >> 9 & 2)) & pt >> 1), 256);
		},

		phase_shifted_saw(key, phaseOffset, voices, id) {
			return modPos(bbGenKey(id, p(key) * tf) + phaseOffset, 256);
		},

		chorus_saw(key, phaseOffset, voices, id) {
			const phase = bbGenKey(id, p(key) * tf);
			return (modPos(phase, 256) + modPos(phase + phaseOffset, 256)) / 2;
		},

		SuperChorus(key, spread, voices = 10, id) {
			voices += 1;
			let e = 0;
			const f = bbGenKey(id, p(key) * tf);
			for (let i = 0; i <= voices; i++) {
				const d = (i / voices) / ((i / voices) + 1) * 5.5 - 1.75;
				e += modPos(f + spread * (1 + d) * 2 + d * 1e7, 256);
			}
			return e / (voices + 1);
		},

		and_3(key, spread, voices = 10, id) {
			voices += 1;
			const baseFreq = p(key) * tf;
			let sum = 0;
			for (let i = 0; i <= voices; i++) {
				const d = Math.sin((i / voices - 0.5) * Math.PI);
				const x = bbGenKey(id + ":v" + i, baseFreq * (1 + d * 0.003)) + 1e7 * d;
				const y = Math.abs((spread & 255) - 128) / 128;
				sum += (~x & x - spread & 255) + y * y * 128 - y * 64 + 64;
			}
			return sum / (voices + 1);
		},

		and_3_simple(key, spread, voices = 10, id) {
			voices += 1;
			let sum = 0;
			const f = bbGenKey(id, p(key) * tf);
			const y = Math.abs((spread & 255) - 128) / 128;
			for (let i = 0; i <= voices; i++) {
				const d = (i / voices) / ((i / voices) + 1) * 5.5 - 1.75;
				const phase = f * (1 + d * 0.003) + d * 1e7;
				const x = modPos(phase, 256);
				sum += ((~x & (x - spread)) & 255) + y * y * 128 - y * 64 + 58;
			}
			return sum / (voices + 1);
		}
	};

	// ─── Filter Dispatch ──────────────────────────────────────────────────────
	// Each filter call gets a unique id derived from the voice id + filter slot

	const filterFunctions = {
		0: (signal, freq, res, id) => signal,
		1: (signal, freq, res, id) => lp(signal-128, freq, res, id + ":lp") + 128,
		2: (signal, freq, res, id) => bp(signal-128, freq, res, id + ":bp") + 128,
		3: (signal, freq, res, id) => hp(signal-128, freq, res, id + ":hp") + 128,
	};

	// ─── Per-Voice Synthesis ──────────────────────────────────────────────────

	function processVoice(key, waveIndex, param1, param2, filterType, freq, res, enDel, del, delFeed, pitch_by_speed, id) {
		const waveKeys = Object.keys(waveFunctions);
		let selectedWave = waveKeys[waveIndex];
		if (selectedWave === undefined || !(selectedWave in waveFunctions)) {
			selectedWave = 'saw';
		}

		// Wave id scoped by voice id + wave name
		const baseSignal = waveFunctions[selectedWave](key, param1, param2, id + ":" + selectedWave);

		const pitch = p(key) * tf;
		let stride = 256 / pitch;
		if (stride > maxDelay) stride = maxDelay;
		if (stride < 1) stride = 1;
		const len = stride | 0;

		let voices = enDel | 0;
		if (voices < 0) voices = 0;
		if (voices > MAX_PER_VOICE_CHORUS) voices = MAX_PER_VOICE_CHORUS;

		const voiceState = lruGetOrCreate(
			dssVoiceState,
			id,
			() => ({ bufs: [], read: [] }),
			MAX_VOICE_STATES
		);

		for (let i = 0; i < voices; i++) {
			if (!voiceState.bufs[i] || voiceState.bufs[i].length !== len) {
				voiceState.bufs[i] = new Float32Array(len);
				voiceState.read[i] = 0;
			} else if (voiceState.read[i] === undefined) {
				voiceState.read[i] = 0;
			}
		}

		let v = baseSignal / 128 - 1;
		let chorusAccum = 0;

		for (let i = 0; i < voices; i++) {
			const buf = voiceState.bufs[i];
			let write = voiceState.read[i] + 1;
			if (write >= len) write = 0;
			voiceState.read[i] = write;

			const phaseOffset = Math.cos(i);
			const pitchScale = pitch_by_speed ? pitch*2 : 1;
			const mod = del * pitchScale;

			let read = write % len + (voices - 1
			    ? Math.abs(1 - modPos(mod * phaseOffset + phaseOffset * 1000, 2)) * len
			    : modPos(-mod * phaseOffset, 1) * len);
			if (read >= len) read -= len;

			const readIdx = read | 0;
			const delayed = buf[readIdx];
			chorusAccum += delayed;
			buf[write] = v + delayed * delFeed;
		}

		const delayed = voices ? chorusAccum + v : 0;
		const out = enDel
			? (delayed / (voices + 1) * 128 * (delFeed >= 0 ? 1 : -1) + 128)
			: baseSignal;

		// Filter id scoped by voice id
		return filterFunctions[filterType](out, freq, res, id);
	}

	// ─── Key Processing ───────────────────────────────────────────────────────

	function inverse(y) {
		return 12 * (Math.log(y) / Math.log(2));
	}

	let processedKeys = [];
	const keys = Array.isArray(c) ? c : [c];
	keys.forEach(key => {
		if (Array.isArray(key) && !key.includes('')) {
			processedKeys.push(key);
		} else {
			processedKeys.push([key]);
		}
	});

	const activeKeys = processedKeys.filter(key => !key.includes(''));
	const hasOff = processedKeys.some(key => key.includes(''));

	let sum = 0;
	let individualSums = [];

	if (!hasOff) {
		for (let i = 0; i < activeKeys.length; i++) {
			const keyGroup 		= activeKeys[i];
			const waveIndex		= waveSelections[i % waveSelections.length];
			const volume			= volumes[i % volumes.length];
			const curParam1		= peram1[i % peram1.length];
			const curParam2		= peram2[i % peram2.length];
			const filterType		= filter_select[i % filter_select.length];
			const freq				= filter_freq[i % filter_freq.length];
			const res				= filter_res[i % filter_res.length];
			const enDelay			= en_del[i % en_del.length];
			const delay				= del[i % del.length];
			const delayFeed		= del_feed[i % del_feed.length];
			const pitchbyspeed = pitch_by_speed[i % del_feed.length]

			let chordSum = 0;
			for (let n = 0; n < keyGroup.length; n++) {
				const note = keyGroup[n];
				// Explicit voice id: group index + note index within chord
				const voiceId = "g" + i + "n" + n;
				chordSum += processVoice(
					note, waveIndex, curParam1, curParam2,
					filterType, freq, res,
					enDelay, delay, delayFeed, pitchbyspeed, voiceId
				);
			}

			const groupSum = (chordSum - keyGroup.length * 128) * volume + 128;
			individualSums.push(groupSum);
			sum += groupSum;
		}
	}

	const result = hasOff
		? 0
		: (activeKeys.length > 0 ? sum - 128 * activeKeys.length : 0);

	const tIdx = modPos(Math.floor(t), SIZE);
	const meter = 20 * Math.log10(
		// Explicit id for this meter hpf instance
		rms(Math.abs(hpf(dss[tIdx] * 128, 0.001, "meter:hpf")), 1 / 500, "meter:rms")
	);

	// ─── Global Chorus ────────────────────────────────────────────────

	let v = result / 128;
	let globVoices = Glob_en_del | 0;
	if (globVoices < 0) globVoices = 0;
	if (globVoices > MAX_GLOBAL_CHORUS) globVoices = MAX_GLOBAL_CHORUS;

	let chorusAccum = 0;

	for (let i = 0; i < globVoices; i++) {
		if (!dlyVoice[i]) {
			dlyVoice[i] = new Float32Array(SIZE);
			dlyRead[i] = 0;
		}
	}

	for (let i = 0; i < globVoices; i++) {
		const buf = dlyVoice[i];

		let write = dlyRead[i] + 1;
		if (write >= SIZE) write = 0;
		dlyRead[i] = write;

		const phaseOffset = Math.sin(i) + 1;
		let read = write + (globVoices - 1
			? Math.abs(1 - modPos(Glob_del * phaseOffset + phaseOffset * 1000, 2)) * SIZE
			: modPos(-Glob_del * phaseOffset, 1) * SIZE);
		if (read >= SIZE) read -= SIZE;

		const readIdx = read | 0;
		const delayed = buf[readIdx];
		chorusAccum += delayed;
		buf[write] = v + delayed * Glob_del_feed;
	}

	const delayed = globVoices ? (chorusAccum + v) / (globVoices + 1) : v;
	dss[tIdx] = delayed;

	return dss[tIdx];
}


// --- Math & DSP Helpers ---

// ─── Precomputed Hilbert allpass coefficients ─────────────────────────────────
// These were computed every sample inside the stage via Math.tanh — now static.
// Bank 0: odd spacing  (j*2+1)/f*2-1  for j=0..15
// Bank 1: even spacing (j*2)/f*2-1    for j=0..15
const HILBERT_F = 16;
const _hilbertA0 = new Float32Array(HILBERT_F);
const _hilbertA1 = new Float32Array(HILBERT_F);
for (let j = 0; j < HILBERT_F; j++) {
	_hilbertA0[j] = Math.tanh(((j * 2 + 1) / HILBERT_F * 2 - 1) * 4); // hilbertCoeff
	_hilbertA1[j] = Math.tanh(((j * 2)     / HILBERT_F * 2 - 1) * 4);
}

// ─── Math & DSP Helpers ───────────────────────────────────────────────────────

// Inline-friendly 1-pole filters. idx is numeric — Float32Array safe.
const hpf2 = (x, idx, cutoff, state) => {
	let v = state.hpf[idx];
	v += cutoff * (x - v);
	state.hpf[idx] = v;
	return x - v;
};

const lpf2 = (x, idx, cutoff, state) => {
	let v = state.lpf[idx];
	v += cutoff * (x - v);
	state.lpf[idx] = v;
	return v;
};

function hilbertCoeff(t) {
	return Math.tanh(t * 4);
}

class DSPPipeline {

	constructor() {
		this.state = this.createInitialState();
		this.stages = [];
	}

	createInitialState() {
		return {
			ap_lp: new Float32Array(8),
			ap_fp: new Float32Array(8),

			delayBuf: new Float32Array(2048),
			delayIdx: 0,

			// Sized to the max numeric index used: hpf[0,2], lpf[1,2]
			hpf: new Float32Array(4),
			lpf: new Float32Array(4),

			FS: {
				ap_lp: new Float32Array(HILBERT_F * 2),
				ap_fp: new Float32Array(HILBERT_F * 2)
			},

			FS2: {
				ap_lp: new Float32Array(12),
				ap_fp: new Float32Array(12)
			},

			// Cache last shiftPhase so we only recompute cos/sin when it changes
			_lastShiftPhase: NaN,
			_cosPhase: 1,
			_sinPhase: 0
		};
	}

	*[Symbol.iterator]() {
		for (let stage of this.stages) yield stage;
	}

	addStage(fn) {
		this.stages.push(fn);
		return this;
	}

	process(input, id, opts = { x: 0, y: 0, z: 0 }) {
		const ctx = {
			y: input,
			y_i: input,
			opts,
			state: this.state
		};
		for (const stage of this) stage(ctx);
		return ctx.y;
	}
}

function makePipeline() {

	const p = new DSPPipeline();

	// ── Stage 1: parameter setup ──────────────────────────────────────────────
	p.addStage((ctx) => {
		const { x, y, z, HPF_cutoff = 0.001, resonance = 0 } = ctx.opts;
		ctx.params = {
			stages:     6,
			cutoff:     clamp(0, 0.999, x * 0.8),
			shiftPhase: -(y - .125) * Math.PI * 2,
			flangerAmt: z,
			HPF_cutoff,
			resonance,
			resFactor:  1 - Math.abs(resonance) / 10
		};
	});

	// ── Stage 2: Phaser + HPF ──────────────────────────────────────────
	p.addStage((ctx) => {
		const ap_lp = ctx.state.ap_lp;
		const ap_fp = ctx.state.ap_fp;
		const a     = 1 - ctx.params.cutoff;
		const n     = ctx.params.stages;
		let y       = ctx.y;

		for (let i = 0; i < n; i++) {
			const lp  = ap_lp[i];
			const fp  = ap_fp[i];
			const apy = lp + a * (fp - y);
			ap_lp[i]  = y;
			ap_fp[i]  = apy;
			y = apy;
		}

		ctx.y   = hpf2(y, 0, ctx.params.HPF_cutoff, ctx.state);
		ctx.y_i = ctx.y;
	});

	// ── Stage 3: Hilbert frequency shifter ───────────────────────────────────
	p.addStage((ctx) => {
		const S     = ctx.state.FS;
		const ap_lp = S.ap_lp;
		const ap_fp = S.ap_fp;
		const F     = HILBERT_F;
		let o0      = ctx.y;
		let o90     = ctx.y;

		// Bank 0 — precomputed coefficients from _hilbertA0
		for (let j = 0; j < F; j++) {
			const a  = _hilbertA0[j];
			const lp = ap_lp[j];
			const fp = ap_fp[j];
			const y1 = lp + a * (fp - o0);
			ap_lp[j] = o0;
			ap_fp[j] = y1;
			o0 = y1;
		}

		// Bank 1 — precomputed coefficients from _hilbertA1
		for (let j = 0; j < F; j++) {
			const a  = _hilbertA1[j];
			const lp = ap_lp[j + F];
			const fp = ap_fp[j + F];
			const y1 = lp + a * (fp - o90);
			ap_lp[j + F] = o90;
			ap_fp[j + F] = y1;
			o90 = y1;
		}

		// Cache cos/sin — only recompute when shiftPhase actually changes
		const sp = ctx.params.shiftPhase;
		if (sp !== ctx.state._lastShiftPhase) {
			ctx.state._lastShiftPhase = sp;
			ctx.state._cosPhase = Math.cos(sp);
			ctx.state._sinPhase = Math.sin(sp);
		}
		const c = ctx.state._cosPhase;
		const s = ctx.state._sinPhase;

		const real = o0 * c - o90 * s;
		const imag = o0 * s + o90 * c;

		ctx.y   = lpf2(real, 1, ctx.params.resFactor, ctx.state);
		ctx.y_i = lpf2(imag, 2, ctx.params.resFactor, ctx.state);
	});

	// ── Stage 4: Flanger ─────────────────────────────────────────────────────
	p.addStage((ctx) => {
		ctx.y = hpf2(ctx.y, 2, ctx.params.HPF_cutoff, ctx.state);

		if (ctx.params.flangerAmt > 0) {
			const buf   = ctx.state.delayBuf;
			const L     = buf.length;          // power-of-2, so & mask works
			const delay = 1 + ctx.params.flangerAmt * 160;
			const rIdx  = (ctx.state.delayIdx - (delay | 0) + L) & (L - 1);
			const delayed = buf[rIdx];
			buf[ctx.state.delayIdx] = ctx.y;
			ctx.state.delayIdx = (ctx.state.delayIdx + 1) & (L - 1);
			ctx.y = delayed;
		}
	});

	return p;
}

const clamp = (n, x, v) => Math.min(Math.max(v, n), x);
const mod = (n, m) => ((Math.floor(n) % m) + m) % m;
const fmod = (n, m) => ((n % m) + m) % m;

const pattern = (SongTime) => {
	const partA = fmod(SongTime / 4, 1) - mod(SongTime * 2 + 1, 2) / 2;
	const gate = Math.max(partA, 0);
	const bitA = (Math.floor(SongTime / 2) & 3);
	const bitB = (Math.floor(SongTime * 4) & 7);
	const partB = mod(bitA ^ bitB, 8) / 16;
	return clamp(gate - partB, 1, 0);
};


return function process(t, sr) {
	const r = 130/120
	const x = t*r;
	const x_mod = pattern(x*2);
	const y_mod = [
							x,-((x*2%1)**.3)*2,
							bbRand(x*4+4&7),
							x+bbRand(x*4+4&7),
							x+bbRand(x*4&7)-((x*2%1)**.3)*2,
							bbRand((x*4+4&7)+4)+sin(t*PI*8)/40,
						][5]
	const z_mod = (-Math.cos(x_mod*Math.PI*3)+1)/4;
	callCount = 0;

	const iterations = 8

	const resonance = -1
	const pipeRes = 0;
	const mixPrev = 1

	const at	= Math.log2(2 / (1 / sr * 440 * 256)) * 12 + 9;
	const k = [0,0,-5,-1][x/2&3]+20

	const output = g(
		[
			k,k+12,[mod(k+8,12)+28,mod(k+11,12)+28,mod(k+3,12)+28]
		],
	
		[4],
		[0.007],
		3,
	
		[0.2,0.2,0.2],
	
		[0],
		[0],
		[0],

		0,
		0,
		0,
		0,
	
		0,
		0,
		0,
	
		// 8,
		// x/16,
		// -0.9,
	
		t, sr
	);

	const source = output

	if(!process._pipes){

		process._pipes = Array.from({length:iterations},()=>({
			pipe: makePipeline(),
			lpf: 0
		}));

		process._re = 0;
	}

	let d = source;

	const opts = {x:x_mod,y:y_mod,z:z_mod,resonance:pipeRes};

	d += process._re * resonance;

	for(let i=0;i<iterations;i++){

		const stage = process._pipes[i];
		const pipe = stage.pipe;
		prevd=d

		d += pipe.state.re * pipeRes || 0;

		d = pipe.process(d,"main_"+i,opts);

		stage.lpf += (d - stage.lpf) * (1 - Math.abs(resonance)/10);
		d = (prevd*mixPrev+stage.lpf*(2-mixPrev))/2

		pipe.state.re = d;
	}

	process._re = d

	out=(d+source/40)*((x*2%1)**1.5)*2+source/20

	out=hp(out,.05,0,"out12")
	out+=sin(cbrt(x%.5/r/2)*350)/3
	out=hp(out,.05,0,"out24")
	
	
	return out
}
