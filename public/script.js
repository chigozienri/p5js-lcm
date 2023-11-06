// requires 'https://cdn.jsdelivr.net/npm/gif-encoder-2@1.0.5/index.min.js'
let replicateEndpoint = 'api/predictions' // if using Replicate
let localEndpoint = 'http://localhost:5001/predictions' // if using local LCM from https://github.com/replicate/latent-consistency-model/tree/prototype
let endpoint = localEndpoint;

let images = [];
let currentImage;
let size = 256;
let playing = false;
var waiting = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setup() {
    let canvas = createCanvas(512, 512);
    pixelDensity(1); // Otherwise canvas boundary check breaks for retina displays
    noStroke();

    let container = document.createElement("div");
    container.innerHTML = "<h1 style=\"font-size: 300%;\">Endless Zoom</h1><h2 style=\"font-size: 120%;\">Scroll to change cursor size; click to zoom in</h2>"
    container.setAttribute("style", "width: 100%; text-align: center; padding: 10rem; margin: auto auto;");
    container.setAttribute("width", "512");
    container.setAttribute("id", "container");
    document.body.appendChild(container);

    canvas.parent("container");
    canvas.id("canvas");
    document.querySelector('#canvas').setAttribute("style", "margin: 0 auto; height: 400px; border: 2px solid black");

    let formContainer = document.createElement("div");
    formContainer.setAttribute("id", "formContainer");
    formContainer.setAttribute("style", "display: flex; flex-direction: column; gap: 1rem; padding: 1rem; align-items: center; align-content: center; justify-content: center;");
    container.appendChild(formContainer);

    let fullscreenButton = document.createElement("img");
    fullscreenButton.setAttribute("src", "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/fullscreen/default/24px.svg")
    fullscreenButton.setAttribute("id", "fullscreenButton");
    fullscreenButton.setAttribute("style", "cursor: pointer");
    fullscreenButton.addEventListener("click", (e) => { document.querySelector('#canvas').requestFullscreen() });
    formContainer.appendChild(fullscreenButton);

    let promptAndSteps = document.createElement("div");
    promptAndSteps.setAttribute("style", "width: 50%; display: flex; flex-direction: row; gap: 0.5rem; align-items: center; align-content: center; justify-content: center");
    formContainer.appendChild(promptAndSteps)
    // Text input box for a prompt
    let promptLabel = document.createElement("label");
    promptLabel.setAttribute("for", "promptInput");
    promptLabel.innerText = "Prompt:";
    promptAndSteps.appendChild(promptLabel);
    let promptInput = document.createElement("input");
    promptInput.setAttribute("type", "text");
    promptInput.setAttribute("value", "New York streetscape");
    promptInput.setAttribute("id", "promptInput");
    promptInput.setAttribute("style", "margin: 0 auto;");
    promptAndSteps.appendChild(promptInput);

    // Text input box for number of steps
    let stepsLabel = document.createElement("label");
    stepsLabel.setAttribute("for", "steps");
    stepsLabel.innerText = "Steps:";
    promptAndSteps.appendChild(stepsLabel);

    let steps = document.createElement("input");
    steps.setAttribute("type", "number");
    steps.setAttribute("value", 1);
    steps.setAttribute("min", 1);
    steps.setAttribute("max", 6);
    steps.setAttribute("id", "steps");
    steps.setAttribute("style", "margin: 0 auto;");
    promptAndSteps.appendChild(steps);

    // Slider that scrubs through history
    let historyContainer = document.createElement("div");
    historyContainer.setAttribute("id", "historyContainer");
    historyContainer.setAttribute("style", "display: none; background-color: #EEEEEE; flex-direction: column; gap: 1rem; padding: 1rem; align-items: center; align-content: center; justify-content: center");
    historyContainer.innerHTML = "<div style=\"flex-basis: 100%\"><h2 style=\"font-size: 120%\">History (scrub to go back)</h2></div>"
    formContainer.appendChild(historyContainer);

    let historyInnerContainer = document.createElement("div");
    historyInnerContainer.setAttribute("id", "historyInnerContainer");
    historyInnerContainer.setAttribute("style", "width: 50%; display: flex; flex-direction: row; gap: 0.5rem; align-items: center; align-content: center; justify-content: center");
    historyContainer.appendChild(historyInnerContainer)

    let historySlider = document.createElement("input");
    historySlider.setAttribute("id", "historySlider");
    historySlider.setAttribute("style", "flex-basis: 70%;");
    historySlider.setAttribute("type", "range");
    historySlider.setAttribute("min", "1");
    historySlider.setAttribute("max", "1");
    historySlider.setAttribute("value", "1");

    historySlider.addEventListener("input", (e) => { frameNumberToCanvas(parseInt(e.target.value)) });
    historyInnerContainer.appendChild(historySlider);

    let playButton = document.createElement("button");
    playButton.setAttribute("id", "playButton");
    playButton.setAttribute("style", "flex-basis: 20%;");
    playButton.setAttribute("type", "button");
    playButton.innerHTML = "Play"
    playButton.addEventListener("click", (e) => {
        playing = !playing;

        function play() {
            playButton.innerHTML = playing ? "Pause" : "Play";
            txt2imgButton.disabled = playing
            if (playing) {
                historySlider.value = (parseInt(historySlider.value)) % images.length + 1;
                frameNumberToCanvas(parseInt(historySlider.value));
                setTimeout(play, 500);
            }
        }
        play();
    });
    historyInnerContainer.appendChild(playButton);



    let downloadButton = document.createElement("button");
    downloadButton.innerHTML = "Download Images"
    downloadButton.addEventListener("click", () => {

        async function toDataURL(url) {
            const blob = await fetch(url).then(res => res.blob());
            return URL.createObjectURL(blob);
        }

        async function download(url, filename) {
            const a = document.createElement("a");
            a.href = await toDataURL(url);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        for (const [i, im_url] of images.entries()) {
            download(im_url, `image_${i.toString().padStart(3, '0')}.png`);
        }
    });
    historyInnerContainer.appendChild(downloadButton);


    let txt2imgButton = document.createElement("button");
    txt2imgButton.setAttribute("id", "txt2imgButton");
    txt2imgButton.setAttribute("type", "button");
    txt2imgButton.innerHTML = "Reset"
    txt2imgButton.addEventListener("click", (e) => {
        images = []
        historyContainer.style.display = "none";
        dream(promptInput.value, undefined, steps.value);
    });
    formContainer.appendChild(txt2imgButton);

    setTimeout(() => {
        data_uri = 'https://replicate.delivery/pbxt/4L6vyIjY6Q64OZlWQTJogKIwvDF1NVvHNKIdleNyG35nbD6IA/out-0.png'
        loadImage(data_uri,
            (img) => {
                image(img, 0, 0, canvas.width, canvas.height);
                images.push(data_uri);
                img["frameNumber"] = 1;
                currentImage = img;
            });
    }, 10);
    drawCursor();


}

function draw() {

}

function imageToCanvas(im_url, frameNumber) {
    loadImage(
        im_url,
        (img) => {
            image(img, 0, 0, canvas.width, canvas.height);
            img["frameNumber"] = frameNumber;
            currentImage = img;
        }
    )
}

function frameNumberToCanvas(frameNumber) {
    imageToCanvas(images[frameNumber - 1], frameNumber);
}

function mouseReleased() {
    if (!waiting) {
        // Check that mouse is in bounds of canvas
        let canvas = document.querySelector('#canvas');
        if (mouseX >= 0 && mouseX <= canvas.width && mouseY >= 0 && mouseY <= canvas.height) {
            let offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 512;
            offscreenCanvas.height = 512;
            let ctx = offscreenCanvas.getContext('2d');

            // Define the source clipping region (the zoomed-in box)
            let srcX = mouseX - size / 2;
            let srcY = mouseY - size / 2;
            let srcWidth = size;
            let srcHeight = size;

            // Define the destination region on the canvas
            let destX = 0;
            let destY = 0;
            let destWidth = canvas.width;
            let destHeight = canvas.height;

            // Clear the canvas
            clear();
            if (images.length > 0) {
                // Redraw the image on the canvas
                let img = currentImage;
                image(img, 0, 0, canvas.width, canvas.height)
            }

            // Draw the original image onto the offscreen canvas, zoomed
            ctx.drawImage(canvas, srcX, srcY, srcWidth, srcHeight, destX, destY, destWidth, destHeight);
            drawCursor();

            // Get the data URI from the resized offscreen canvas
            let img = offscreenCanvas.toDataURL("image/jpeg");

            let prompt = document.querySelector('#promptInput').value;
            let steps = parseInt(document.querySelector('#steps').value);
            dream(prompt, img, steps);
        }
    }
}

function drawSquareBox(centerX, centerY, side) {
    rectMode(CENTER);
    noFill();
    strokeWeight(4);
    stroke('black');
    rect(centerX, centerY, side, side);
    noStroke();
}

function drawCursor() {
    let canvas = document.querySelector('#canvas')
    // Clear the canvas
    clear();
    if (images.length > 0) {
        // Redraw the image on the canvas
        let img = currentImage;
        image(img, 0, 0, canvas.width, canvas.height)
    }
    // Draw cursor
    drawSquareBox(mouseX, mouseY, size);
}

function mouseMoved() {
    // Check that mouse is in bounds of canvas
    let canvas = document.querySelector('#canvas');
    if (mouseX >= 0 && mouseX <= canvas.width && mouseY >= 0 && mouseY <= canvas.height) {
        // Check not in playback
        if (!playing) {
            drawCursor();
        }
    };
}

function mouseWheel(e) {
    // Check that mouse is in bounds of canvas
    let canvas = document.querySelector('#canvas');
    if (mouseX >= 0 && mouseX <= canvas.width && mouseY >= 0 && mouseY <= canvas.height) {
        if ((size + e.delta) > 512) {
            size = 512;
        } else if ((size + e.delta) < 50) {
            size = 50;
        } else {
            size = size + e.delta;
        }
        drawCursor();
        return false;
    }
}

function dream(prompt, img, steps) {
    if (playing) {
        // Don't dream if playing, just pause
        playing = false
    } else {
        waiting = true
        let txt2imgButton = document.querySelector('#txt2imgButton');
        txt2imgButton.disabled = true;
        let canvas = document.querySelector('#canvas');
        let input = {
            prompt: prompt,
            steps: steps || 1
        }
        if (img) {
            input['image'] = img
        }


        let historySlider = document.querySelector('#historySlider');

        historySlider.max = currentImage.frameNumber;
        historySlider.value = currentImage.frameNumber;

        let startTime = Date.now();
        fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ input })
        }).then((r) => r.json())
            .then((data) => {
                console.log(`Generated in: ${Date.now() - startTime} ms`);
                let data_uri = data.output;
                loadImage(data_uri, (img) => {
                    image(img, 0, 0, canvas.width, canvas.height);

                    // Remove history after the (previous) image
                    images = images.slice(0, currentImage.frameNumber);

                    // Add current image to history
                    images.push(data_uri);
                    img.frameNumber = images.length;
                    currentImage = img;

                    historySlider.max = images.length;
                    historySlider.value = images.length;
                    if (images.length > 1) {
                        let historyContainer = document.querySelector('#historyContainer');
                        historyContainer.style.display = "flex";
                    }
                });
            }).then(() => {

                waiting = false;
                txt2imgButton.disabled = false;
            });
    }

}