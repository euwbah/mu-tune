/*
    Generalized N equal divisions of X microtonal pitch monitor.
 */

/// Any arbitrary frequency of any particular note in the scale.
let baseFreq = 440;

/// The number of equal divisions of the interval given by the repeatingInterval.
let steps = 22;

/// This number is the '2' in '12ED2', where it represents the just ratio of
/// the interval that will be divided by `steps` number of equal divisions.
let repeatingIntervalType = 2;

/// The root note of the scale to be highlighted is this many steps away from the given `baseFreq`
let rootNoteStepsFromBaseFreq = 0;
let scalePattern = [4, 3, 2, 4, 3, 4, 2];

/// The distance between two notes an octave apart on the screen in px.
/// The metric can be used as a zoom measure (higher px distance = more vertically zoomed in)
let pxDistanceBetweenOctaves = 700;

/// This number represents the number of octaves from the base frequency the bottom of the screen is.
let lowestDisplayedPitch = 0;

/// This number represents the number of octaves from the base frequency the top of the screen is.
let highestDisplayedPitch = lowestDisplayedPitch + window.innerHeight / pxDistanceBetweenOctaves;

let nFrequenciesToStore = window.innerWidth / 2;
let frequencies = [];

const displayScrollSmoothing = 6;
const ampThreshold = -80;
/// A frequency will only be accepted if the average of the last n unfiltered frequencies is within a
/// factor of `frequencyDeviationThreshold` of the current frequency.
const frequencyDeviationThreshold = 1.6;
const nUnfilteredFrequenciesToStore = 15;
const centOffsetSmoothing = 12;

window.oncontextmenu = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

$('#play')[0].oncontextmenu = function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
};

window.onload = ev => {

    {
        let configStr = location.hash.substr(1);

        let [divisionsStr, baseFreqStr, scaleStr, offsetStr] = configStr.split(",");
        let [stepsStr, repeatingIntervalStr] = divisionsStr.split(/ed/i);

        try {
            steps = parseInt(stepsStr);
        } catch (e) {
            alert('Error parsing config: steps')
        }
        try {
            repeatingIntervalType = eval(repeatingIntervalStr);
        } catch (e) {
            alert('Error parsing config: repeating interval')
        }
        try {
            baseFreq = parseFloat(baseFreqStr);
        } catch (e) {
            alert('Error parsing config: base frequency')
        }
        try {
            scalePattern = scaleStr.split('-').map(x => parseInt(x));
        } catch (e) {
            alert('Error parsing config: scale pattern')
        }
        try {
            rootNoteStepsFromBaseFreq = parseInt(offsetStr);
        } catch (e) {
            alert('Error parsing config: root note offset')
        }

        console.log(steps, repeatingIntervalType, baseFreq, scalePattern, rootNoteStepsFromBaseFreq);
    }

    // This will contain the notes to be highlighted as 'white notes' of the scale.
    // e.g. a 12ED2 major scale would make scaleNotes hold the value [0, 2, 4, 5, 7, 9, 11, 12]
    let scaleNotes = [0];
    scalePattern.forEach(x => {
        scaleNotes.push(scaleNotes[scaleNotes.length - 1] + x);
    });

    let cv = $('#cv')[0];
    cv.height = window.innerHeight;
    cv.width = window.innerWidth;
    nFrequenciesToStore = window.innerWidth / 2;

    frequencies = new Array(nFrequenciesToStore).fill(baseFreq);

    let ctx = cv.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let freqtext = $('#freqtext');
    let centstext = $('#centstext');

    let tuner = new Microphone();
    tuner.initialize();

    // Contains the last few raw frequencies from the algorithm to test for high deviations.
    let lastUnfilteredFrequencies = new Array(nUnfilteredFrequenciesToStore).fill(rootNoteStepsFromBaseFreq);

    // Stores the closest tempered note that is picked up by the mic.
    // Units are in steps from base frequency.
    let correctNote = 0;

    let AC = window.AudioContext || window.webkitAudioContext;
    let actx = new AC();

    let gain = actx.createGain();
    gain.gain.value = 0;
    gain.connect(actx.destination);

    let osc = actx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = baseFreq;
    osc.connect(gain);
    osc.start();

    let playBtn = $('#play');

    playBtn[0].onpointerdown = () => {
        gain.gain.value = 0.6;
        playBtn.css({
            filter: 'invert(100%) blur(1px)'
        })
    };

    playBtn[0].onpointerup = () => {
        gain.gain.value = 0;
        playBtn.css({
            filter: 'invert(70%)'
        })
    };

    const frame = () => {
        // Method 1: Autocorrelation
        // Method 2: FFT
        let freq = tuner.getFreq(1);
        let amp = tuner.getMaxInputAmplitude();

        // Manage unfiltered frequencies in order to detect frequency jump anomalies.
        if (!!freq) {
            lastUnfilteredFrequencies.push(freq);
            if (lastUnfilteredFrequencies.length > nUnfilteredFrequenciesToStore)
                lastUnfilteredFrequencies.splice(0, lastUnfilteredFrequencies.length - nUnfilteredFrequenciesToStore);
        }

        let avgUnfilteredFreq = lastUnfilteredFrequencies.reduce((a, b) => a + b) / lastUnfilteredFrequencies.length;

        if (!freq || amp < ampThreshold)
            freq = null;

        if (freq / avgUnfilteredFreq > frequencyDeviationThreshold || avgUnfilteredFreq / freq > frequencyDeviationThreshold) {
            freq = null;
            // console.log('Frequency anomaly detected');
        }

        // Average out frequencies

        if (freq) {
            let smoothFreq = freq * 5;
            let nonNullCount = 0;
            for (let i = frequencies.length - 1; nonNullCount < 5 && i >= 0; i--) {
                let f = frequencies[i];
                if (f) {
                    smoothFreq += frequencies[i];
                    nonNullCount++;
                }
            }

            freq = smoothFreq / (nonNullCount + 5);
        }

        freqtext.text(`${freq ? freq.toFixed(2) : 'nil' }Hz, ${amp.toFixed(2)}dB`);

        frequencies.push(freq);
        if (frequencies.length > nFrequenciesToStore)
            frequencies.splice(0, frequencies.length - nFrequenciesToStore);

        ctx.clearRect(0, 0, cv.width, cv.height);

        if (freq !== null) {
            let currPitchYCoord = convertFreqToYCoord(freq);
            if (currPitchYCoord < 100) {
                highestDisplayedPitch += 0.001 + (100 - currPitchYCoord) / pxDistanceBetweenOctaves / displayScrollSmoothing;
                lowestDisplayedPitch = highestDisplayedPitch - cv.height / pxDistanceBetweenOctaves;
            } else if (currPitchYCoord > cv.height - 100) {
                lowestDisplayedPitch -= 0.001 + (currPitchYCoord - (cv.height - 100)) / pxDistanceBetweenOctaves / displayScrollSmoothing;
                highestDisplayedPitch = lowestDisplayedPitch + cv.height / pxDistanceBetweenOctaves;
            }
        }

        // Draw note lines

        // First convert the repeatingIntervalSize into octaves.
        // If system is n EDO, then repeatingIntervalType is 2
        // If system is in n ED3 (tritaves), then repeatingIntervalType is 3.
        let repeatingIntervalSizeInOctaves = Math.log2(repeatingIntervalType);

        // Calculating the fraction of an octave each step spans is trivial...
        let stepSize = repeatingIntervalSizeInOctaves / steps;

        // The pitch of the bottom-most horizontal pitch line marker in units of steps from the base frequency.
        let lowestNoteLine = Math.ceil(lowestDisplayedPitch / stepSize);

        for (let s = lowestNoteLine; s * stepSize < highestDisplayedPitch; s++) {
            ctx.beginPath();
            if (mod((s - rootNoteStepsFromBaseFreq), steps) === 0) {
                // This line represents the root of the scale
                ctx.strokeStyle = '#55FFFFCC';
                ctx.lineWidth = 5;
            } else if (scaleNotes.includes(mod((s - rootNoteStepsFromBaseFreq), steps))) {
                ctx.strokeStyle = '#00AAFFAA';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = '#AAAAAAAA';
                ctx.lineWidth = 2;
            }

            if (s === correctNote) {
                ctx.strokeStyle = ctx.strokeStyle.substr(0, 7);
                ctx.lineWidth = 7;
            }

            let yCoord = convertFreqToYCoord(baseFreq * repeatingIntervalType ** (s / steps));
            ctx.moveTo(cv.width, yCoord);
            ctx.lineTo(0, yCoord);
            ctx.stroke();
        }

        // Draw pitch line

        // Flag to toggle between moveTo and lineTo.
        let draw = false;

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FF9900BB';

        frequencies.forEach((f, idx) => {
            if (f !== null) {
                if (draw)
                    ctx.lineTo(idx * 2, convertFreqToYCoord(f));
                else {
                    ctx.moveTo(idx * 2, convertFreqToYCoord(f));
                    draw = true;
                }
            } else {
                draw = false;
            }
        });

        ctx.stroke();

        // Calculate cent offset

        // Use average frequencies to make display less haphazard
        let recentFreqs = [];
        for (let i = frequencies.length; recentFreqs.length < centOffsetSmoothing && i >= 0; i--) {
            let f = frequencies[i];
            if (f)
                recentFreqs.push(f);
        }

        let stepsFromBaseFreq;

        if (recentFreqs.length !== 0) {
            let avgFreq = recentFreqs.reduce((a, b) => a + b) / recentFreqs.length;
            let octsFromBaseFreq = Math.log2(avgFreq / baseFreq);
            stepsFromBaseFreq = octsFromBaseFreq / stepSize;
            correctNote = Math.round(stepsFromBaseFreq);
            let centsOffset = (stepsFromBaseFreq - correctNote) * stepSize * 1200;
            centstext.text(`${centsOffset > 0 ? '+' : ''}${centsOffset.toFixed(2)} ¢`)
        }

        // Set oscillator freq to correct note
        osc.frequency.value = baseFreq * repeatingIntervalType ** (correctNote / steps);

        requestAnimationFrame(frame);
    };

    $('.taptostart').click(() => {
        if (tuner.isInitialized()) {
            tuner.startListening();
            $('#msg').css('display', 'none');
            frame();
        } else {
            alert('Not yet loaded... please try again');
        }
    });
};

function mod(n, m) {
    return ((n % m) + m) % m;
}

function convertFreqToYCoord(freq) {
    let octavesFromBaseFreq = Math.log2(freq / baseFreq);
    return (highestDisplayedPitch - octavesFromBaseFreq) * pxDistanceBetweenOctaves;
}

window.onresize = () => {
    let cv = $('#cv')[0];
    cv.height = window.innerHeight;
    cv.width = window.innerWidth;
    nFrequenciesToStore = window.innerWidth / 2;

    // update lowest and highest displayed pitches so that the pitch at the center of the screen
    // remains constant through the old and new screen sizes.
    let previousHeight = (highestDisplayedPitch - lowestDisplayedPitch) * pxDistanceBetweenOctaves;
    let heightDiff = window.innerHeight - previousHeight;
    lowestDisplayedPitch += heightDiff / pxDistanceBetweenOctaves / 2;
    highestDisplayedPitch = lowestDisplayedPitch + window.innerHeight / pxDistanceBetweenOctaves;
};