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

const displayScrollSmoothing = 10;

window.onload = ev => {

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

    let voice = new Wad({source : 'mic' }); // At this point, your browser will ask for permission to access your microphone.
    let tuner = new Wad.Poly();
    tuner.setVolume(0); // If you're not using headphones, you can eliminate microphone feedback by muting the output from the tuner.
    tuner.add(voice);

    voice.play(); // You must give your browser permission to access your microphone before calling play().

    tuner.updatePitch();
    // The tuner is now calculating the pitch and note name of its input 60 times per second.
    // These values are stored in <code>tuner.pitch</code> and <code>tuner.noteName</code>.

    const frame = () => {
        // console.log(tuner.accPitch, tuner.noteName);

        if (tuner.accPitch !== undefined) {
            frequencies.push(tuner.accPitch);
            if (frequencies.length > nFrequenciesToStore)
                frequencies.splice(0, frequencies.length - nFrequenciesToStore);

            ctx.clearRect(0, 0, cv.width, cv.height);

            let currPitchYCoord = convertFreqToYCoord(tuner.accPitch);
            if (currPitchYCoord < 100) {
                highestDisplayedPitch += 0.005 + (100 - currPitchYCoord) / pxDistanceBetweenOctaves / displayScrollSmoothing;
                lowestDisplayedPitch = highestDisplayedPitch - cv.height / pxDistanceBetweenOctaves;
            } else if (currPitchYCoord > cv.height - 100) {
                lowestDisplayedPitch -= 0.005 + (currPitchYCoord - (cv.height - 100)) / pxDistanceBetweenOctaves / displayScrollSmoothing;
                highestDisplayedPitch = lowestDisplayedPitch + cv.height / pxDistanceBetweenOctaves;
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
                    ctx.strokeStyle = '#33DDFF';
                    ctx.lineWidth = 5;
                } else if (scaleNotes.includes(mod((s - rootNoteStepsFromBaseFreq), steps))) {
                    ctx.strokeStyle = '#0099FF';
                    ctx.lineWidth = 3;
                } else {
                    ctx.strokeStyle = '#AAAAAA';
                    ctx.lineWidth = 2;
                }

                let yCoord = convertFreqToYCoord(baseFreq * repeatingIntervalType ** (s / steps));
                ctx.moveTo(cv.width, yCoord);
                ctx.lineTo(0, yCoord);
                ctx.stroke();
            }


            // Draw pitch line

            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FF9900BB';
            ctx.moveTo(0, convertFreqToYCoord(frequencies[0]));

            frequencies.forEach((f, idx) => {
                ctx.lineTo(idx * 2, convertFreqToYCoord(f));
            });

            ctx.stroke();

        }
        requestAnimationFrame(frame);
    };
    frame();
    // If you sing into your microphone, your pitch will be logged to the console in real time.
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