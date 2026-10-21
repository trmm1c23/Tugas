// Vercel Serverless Function: api/cuaca.js
const { ACEH_WILAYAH_TREE } = require('./wilayah');

function findKelurahanInfo(id, adm4) {
  let matched = null;
  for (const kab of ACEH_WILAYAH_TREE) {
    for (const kec of kab.kecamatan) {
      for (const kel of kec.kelurahan) {
        if ((id && kel.id === Number(id)) || (adm4 && kel.kode_adm4 === adm4)) {
          return {
            kelurahan_id: kel.id,
            nama_kelurahan: kel.nama,
            kode_adm4: kel.kode_adm4,
            kecamatan_id: kec.id,
            nama_kecamatan: kec.nama,
            kabupaten_id: kab.id,
            nama_kabupaten: kab.nama
          };
        }
      }
    }
  }

  // Default to first kelurahan (Kampung Jawa Baru)
  const defaultKab = ACEH_WILAYAH_TREE[0];
  const defaultKec = defaultKab.kecamatan[0];
  const defaultKel = defaultKec.kelurahan[0];
  return {
    kelurahan_id: defaultKel.id,
    nama_kelurahan: defaultKel.nama,
    kode_adm4: defaultKel.kode_adm4,
    kecamatan_id: defaultKec.id,
    nama_kecamatan: defaultKec.nama,
    kabupaten_id: defaultKab.id,
    nama_kabupaten: defaultKab.nama
  };
}

function formatHariIndonesia(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) {
    return `Hari Ini (${d} ${bulan[m]})`;
  } else if (dateStr === tomorrowStr) {
    return `Besok (${d} ${bulan[m]})`;
  }
  return `${hari[dateObj.getDay()]}, ${d} ${bulan[m]}`;
}

function parseBmkgWeatherResponse(json, adm4) {
  const lokasi = json.lokasi || {};
  const dataBlock = (json.data && json.data[0]) || {};
  const cuacaDays = dataBlock.cuaca || [];

  if (!cuacaDays || cuacaDays.length === 0) {
    throw new Error('Data cuaca tidak tersedia untuk wilayah ini.');
  }

  const allSlots = [];
  const dailyGroups = [];

  for (const daySlots of cuacaDays) {
    if (!Array.isArray(daySlots)) continue;

    let dayDateKey = null;
    const dayTemps = [];
    const dayHumidities = [];
    const dayDescriptions = [];

    for (const slot of daySlots) {
      const localTimeStr = slot.local_datetime || slot.datetime || '';
      const ts = new Date(localTimeStr.replace(' ', 'T')).getTime() || Date.now();
      const dateObj = new Date(ts);

      const y = dateObj.getFullYear();
      const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
      const da = String(dateObj.getDate()).padStart(2, '0');
      const ho = String(dateObj.getHours()).padStart(2, '0');
      const mi = String(dateObj.getMinutes()).padStart(2, '0');

      const dateKey = `${y}-${mo}-${da}`;
      if (!dayDateKey) dayDateKey = dateKey;

      const formattedSlot = {
        datetime: slot.datetime || '',
        local_datetime: localTimeStr,
        timestamp: Math.floor(ts / 1000),
        jam: `${ho}:${mi}`,
        tanggal: `${da} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][dateObj.getMonth()]} ${y}`,
        suhu: slot.t !== undefined ? Number(slot.t) : null,
        kelembapan: slot.hu !== undefined ? Number(slot.hu) : null,
        kondisi_cuaca: slot.weather_desc || 'Tidak Diketahui',
        kondisi_cuaca_en: slot.weather_desc_en || '',
        weather_code: slot.weather !== undefined ? slot.weather : null,
        kecepatan_angin: slot.ws !== undefined ? `${slot.ws} km/jam` : '-',
        kecepatan_angin_val: slot.ws || 0,
        arah_angin: slot.wd || '-',
        arah_angin_deg: slot.wd_deg !== undefined ? slot.wd_deg : null,
        tutupan_awan: slot.tcc !== undefined ? `${slot.tcc}%` : '-',
        tutupan_awan_val: slot.tcc !== undefined ? slot.tcc : null,
        curah_hujan: slot.tp !== undefined ? `${slot.tp} mm` : '0 mm',
        icon_cuaca: slot.image || 'https://api-apps.bmkg.go.id/storage/icon/cuaca/cerah-am.svg'
      };

      allSlots.push(formattedSlot);
      if (slot.t !== undefined) dayTemps.push(Number(slot.t));
      if (slot.hu !== undefined) dayHumidities.push(Number(slot.hu));
      if (slot.weather_desc) dayDescriptions.push(slot.weather_desc);
    }

    if (dayTemps.length > 0) {
      // Find dominant condition
      const counts = {};
      for (const d of dayDescriptions) {
        counts[d] = (counts[d] || 0) + 1;
      }
      let dominantDesc = 'Cerah Berawan';
      let maxC = 0;
      for (const [desc, c] of Object.entries(counts)) {
        if (c > maxC) {
          maxC = c;
          dominantDesc = desc;
        }
      }

      const midSlot = daySlots[Math.floor(daySlots.length / 2)] || daySlots[0] || {};
      const dominantIcon = midSlot.image || 'https://api-apps.bmkg.go.id/storage/icon/cuaca/cerah berawan-am.svg';

      const avgT = dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length;
      const avgH = dayHumidities.reduce((a, b) => a + b, 0) / Math.max(1, dayHumidities.length);

      dailyGroups.push({
        tanggal: dayDateKey,
        label_hari: formatHariIndonesia(dayDateKey),
        suhu_min: Math.min(...dayTemps),
        suhu_max: Math.max(...dayTemps),
        suhu_avg: Math.round(avgT * 10) / 10,
        kelembapan_avg: Math.round(avgH),
        kondisi_cuaca: dominantDesc,
        icon_cuaca: dominantIcon
      });
    }
  }

  allSlots.sort((a, b) => a.timestamp - b.timestamp);

  const nowSec = Math.floor(Date.now() / 1000);
  let currentSlot = null;
  let minDiff = Infinity;
  for (const s of allSlots) {
    const diff = Math.abs(s.timestamp - nowSec);
    if (diff < minDiff) {
      minDiff = diff;
      currentSlot = s;
    }
  }
  if (!currentSlot && allSlots.length > 0) {
    currentSlot = allSlots[0];
  }

  return {
    status: 'success',
    sumber: 'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)',
    waktu_diambil: new Date().toISOString(),
    lokasi: {
      adm1: lokasi.adm1 || '',
      adm2: lokasi.adm2 || '',
      adm3: lokasi.adm3 || '',
      adm4: lokasi.adm4 || adm4,
      provinsi: lokasi.provinsi || 'Aceh',
      kabupaten: lokasi.kotkab || '',
      kecamatan: lokasi.kecamatan || '',
      kelurahan: lokasi.desa || '',
      latitude: lokasi.lat || null,
      longitude: lokasi.lon || null,
      timezone: lokasi.timezone || 'Asia/Jakarta'
    },
    current: currentSlot,
    hourly: allSlots.slice(0, 16),
    daily: dailyGroups,
    raw_slots_count: allSlots.length
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { kelurahan_id, adm4: paramAdm4 } = req.query || {};
    let kelurahanInfo = findKelurahanInfo(kelurahan_id, paramAdm4);
    const targetAdm4 = paramAdm4 || (kelurahanInfo ? kelurahanInfo.kode_adm4 : '11.73.02.2017');

    const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(targetAdm4)}`;
    const bmkgRes = await fetch(bmkgUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Sistem-Terintegrasi-Cuaca/1.0 (Universitas; Sistem Terintegrasi BMKG)'
      }
    });

    if (!bmkgRes.ok) {
      throw new Error(`API BMKG mengembalikan status ${bmkgRes.status}`);
    }

    const bmkgJson = await bmkgRes.json();
    const parsedData = parseBmkgWeatherResponse(bmkgJson, targetAdm4);

    return res.status(200).json({
      status: 'success',
      wilayah_db: kelurahanInfo,
      cuaca_bmkg: parsedData
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }
};
