use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{
    mem::size_of,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::State;
use windows::Win32::Media::Audio::{
    waveOutClose, waveOutOpen, waveOutPrepareHeader, waveOutReset, waveOutUnprepareHeader,
    waveOutWrite, CALLBACK_NULL, HWAVEOUT, WAVEFORMATEX, WAVEHDR, WAVERR_STILLPLAYING,
};
use windows_core::PSTR;

const MAX_WAVE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Default)]
pub struct Playback(Mutex<Ticket>);

impl Playback {
    pub fn active(&self) -> bool {
        self.0.lock().unwrap().cancelled.is_some()
    }
}

#[derive(Default)]
struct Ticket {
    id: u64,
    cancelled: Option<Arc<AtomicBool>>,
}

pub async fn invoke(
    playback: State<'_, Playback>,
    channel: &str,
    args: Vec<Value>,
) -> Result<Value, String> {
    let request = args.first().ok_or("Falta la operación de voz.")?;
    let id = request["id"]
        .as_u64()
        .filter(|id| *id > 0)
        .ok_or("Turno de voz inválido.")?;
    if channel == "tts:stop-pcm" {
        let mut current = playback.0.lock().unwrap();
        if id >= current.id {
            current.id = id;
            if let Some(previous) = current.cancelled.take() {
                previous.store(true, Ordering::Relaxed);
            }
        }
        return Ok(Value::Null);
    }

    let encoded = request["data"]
        .as_str()
        .filter(|data| data.len() <= MAX_WAVE_BYTES.div_ceil(3) * 4)
        .ok_or("Tamaño de audio local inválido.")?;
    let volume = request["volume"].as_f64().unwrap_or(1.0).clamp(0.0, 1.0);
    let mut wave = STANDARD
        .decode(encoded)
        .map_err(|_| "Audio local inválido.")?;
    let rate = pcm_sample_rate(&wave).ok_or("Formato de audio local inválido.")?;
    drop(args);
    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut current = playback.0.lock().unwrap();
        if id <= current.id {
            return Ok(json!(false));
        }
        if let Some(previous) = current.cancelled.replace(cancelled.clone()) {
            previous.store(true, Ordering::Relaxed);
        }
        current.id = id;
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        play_wave(&mut wave, rate, volume, &cancelled)
    })
    .await
    .map_err(|error| error.to_string())?;
    let mut current = playback.0.lock().unwrap();
    if current.id == id {
        current.cancelled = None;
    }
    result.map(|played| json!(played))
}

fn pcm_sample_rate(wave: &[u8]) -> Option<u32> {
    if !(46..=MAX_WAVE_BYTES).contains(&wave.len())
        || wave.len() % 2 != 0
        || &wave[0..4] != b"RIFF"
        || &wave[8..16] != b"WAVEfmt "
        || u32::from_le_bytes(wave[16..20].try_into().ok()?) != 16
        || wave[20..24] != [1, 0, 1, 0]
        || wave[32..36] != [2, 0, 16, 0]
        || &wave[36..40] != b"data"
        || u32::from_le_bytes(wave[40..44].try_into().ok()?) as usize != wave.len() - 44
    {
        return None;
    }
    let rate = u32::from_le_bytes(wave[24..28].try_into().ok()?);
    (8_000..=192_000).contains(&rate).then_some(rate)
}

fn play_wave(
    wave: &mut Vec<u8>,
    rate: u32,
    volume: f64,
    cancelled: &AtomicBool,
) -> Result<bool, String> {
    if cancelled.load(Ordering::Relaxed) {
        return Ok(false);
    }
    let samples = &mut wave[44..];
    if volume < 1.0 {
        for bytes in samples.chunks_exact_mut(2) {
            let sample = i16::from_le_bytes([bytes[0], bytes[1]]);
            bytes.copy_from_slice(&((f64::from(sample) * volume).round() as i16).to_le_bytes());
        }
    }
    let format = WAVEFORMATEX {
        wFormatTag: 1,
        nChannels: 1,
        nSamplesPerSec: rate,
        nAvgBytesPerSec: rate * 2,
        nBlockAlign: 2,
        wBitsPerSample: 16,
        cbSize: 0,
    };
    let mut device = HWAVEOUT::default();
    let opened = unsafe {
        waveOutOpen(
            Some(&mut device),
            u32::MAX,
            &format,
            None,
            None,
            CALLBACK_NULL,
        )
    };
    if opened != 0 {
        return Err(format!(
            "Windows no pudo abrir la salida de voz ({opened})."
        ));
    }
    let mut header = Box::new(WAVEHDR {
        lpData: PSTR(samples.as_mut_ptr()),
        dwBufferLength: samples.len() as u32,
        ..Default::default()
    });
    let header_pointer: *mut WAVEHDR = &mut *header;
    let header_len = size_of::<WAVEHDR>() as u32;
    let prepared = unsafe { waveOutPrepareHeader(device, header_pointer, header_len) };
    if prepared != 0 {
        unsafe { waveOutClose(device) };
        return Err(format!("Windows no pudo preparar la voz ({prepared})."));
    }
    let played = unsafe { waveOutWrite(device, header_pointer, header_len) };
    let deadline =
        Instant::now() + Duration::from_secs_f64(samples.len() as f64 / (rate as f64 * 2.0) + 5.0);
    let mut stopped = false;
    loop {
        let status = unsafe { waveOutUnprepareHeader(device, header_pointer, header_len) };
        if status == 0 {
            unsafe { waveOutClose(device) };
            return if played == 0 {
                Ok(!stopped)
            } else {
                Err(format!("Windows no pudo reproducir la voz ({played})."))
            };
        }
        if !stopped
            && (played != 0 || cancelled.load(Ordering::Relaxed) || Instant::now() >= deadline)
        {
            stopped = true;
            unsafe { waveOutReset(device) };
        } else if status != WAVERR_STILLPLAYING
            || Instant::now() >= deadline + Duration::from_secs(2)
        {
            // A driver that did not return the buffer may still reference these addresses.
            Box::leak(header);
            std::mem::forget(std::mem::take(wave));
            return Err("Windows no devolvió el búfer de voz.".into());
        }
        thread::sleep(Duration::from_millis(20));
    }
}
