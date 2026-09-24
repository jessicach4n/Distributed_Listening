export function decodeWav(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    // WAV header for 16-bit PCM files
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);

    if (bitsPerSample !== 16) {
        throw new Error("Only 16-bit WAV files are supported");
    }

    let offset = 12;

    while (offset < view.byteLength) {
        const chunkId = readString(view, offset, 4);
        const chunkSize = view.getUint32(offset + 4, true);

        if (chunkId === "data") {
            offset += 8;
            break;
        }

        offset += 8 + chunkSize;
    }

    const bytesPerSample = bitsPerSample / 8;
    const totalSamples = (view.byteLength - offset) / bytesPerSample;

    const channelData = Array.from(
        { length: channels },
        () => new Float32Array(totalSamples / channels)
    );

    let sampleIndex = 0;

    for (let i = 0; i < totalSamples; i++) {
        const sample = view.getInt16(
            offset + i * bytesPerSample,
            true
        );

        const normalized = sample / 32768;
        const channel = i % channels;

        channelData[channel][sampleIndex] = normalized;

        if (channel === channels - 1) {
            sampleIndex++;
        }
    }

    return {
        channels,
        sampleRate,
        channelData
    };
}

function readString(view, offset, length) {
    let result = "";

    for (let i = 0; i < length; i++) {
        result += String.fromCharCode(view.getUint8(offset + i));
    }

    return result;
}