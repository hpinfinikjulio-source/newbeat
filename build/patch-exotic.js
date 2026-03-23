const waitForBytebeat = (maxAttempts = 200, delayMs = 50) =>
	new Promise((resolve) => {
		let attempts = 0;
		const timer = setInterval(() => {
			if(globalThis.bytebeat?.loadCode) {
				clearInterval(timer);
				resolve(true);
				return;
			}
			attempts += 1;
			if(attempts >= maxAttempts) {
				clearInterval(timer);
				resolve(false);
			}
		}, delayMs);
	});

const showExoticLoadError = (error) => {
	const msg = error?.message ? String(error.message) : String(error);
	const errorElem = document.getElementById('error');
	const errorConsole = document.getElementById('error-console');
	if(errorElem) errorElem.innerText = msg;
	if(errorConsole && !errorConsole.classList.contains('hidden')) {
		errorConsole.innerText = msg;
	}
};

const patchExoticTooLongLoader = (bytebeat) => {
	const originalLoadCode = bytebeat.loadCode.bind(bytebeat);
	bytebeat.loadCode = (params = {}, isPlay = true) => {
		if(
			params &&
			params.too_long === true &&
			params.codeFile &&
			(!params.code || params.code.length === 0)
		) {
			fetch(`./data/songs/exotic/${ encodeURIComponent(params.codeFile) }`)
				.then((response) => {
					if(!response.ok) {
						throw new Error(`Failed to load ${ params.codeFile } (${ response.status })`);
					}
					return response.text();
				})
				.then((code) => {
					originalLoadCode({ ...params, code }, isPlay);
				})
				.catch((error) => {
					console.error(error);
					showExoticLoadError(error);
				});
			return;
		}
		return originalLoadCode(params, isPlay);
	};
};

waitForBytebeat().then((ready) => {
	if(ready) {
		patchExoticTooLongLoader(globalThis.bytebeat);
	}
});
