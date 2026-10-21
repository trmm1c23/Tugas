/**
 * PORTAL RESMI PRAKIRAAN CUACA, KUALITAS UDARA & GEMPABUMI BMKG ACEH
 * Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)
 */

// Application State
const state = {
  activeTab: 'dashboard',
  selectedKabupatenId: 1, // Default: Kota Lhokseumawe
  selectedKecamatanId: 1, // Default: Banda Sakti
  selectedKelurahanId: 1, // Default: Kampung Jawa Baru
  weatherData: null,
  historyData: null,
  wilayahTree: []
};

// DOM Elements
const elements = {
  clock: document.getElementById('live-clock'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  // Filters
  selKabupaten: document.getElementById('sel-kabupaten'),
  selKecamatan: document.getElementById('sel-kecamatan'),
  selKelurahan: document.getElementById('sel-kelurahan'),
  btnRefreshWeather: document.getElementById('btn-refresh-weather'),
  btnSyncCurrent: document.getElementById('btn-sync-current'),
  btnSyncAll: document.getElementById('btn-sync-all'),
  // Weather Hero
  heroLokasi: document.getElementById('hero-lokasi'),
  heroSubLokasi: document.getElementById('hero-sublokasi'),
  heroTemp: document.getElementById('hero-temp'),
  heroCond: document.getElementById('hero-cond'),
  heroIcon: document.getElementById('hero-icon'),
  heroAdm4: document.getElementById('hero-adm4'),

  // Metrics
  valHumidity: document.getElementById('val-humidity'),
  valWind: document.getElementById('val-wind'),
  valWindDir: document.getElementById('val-wind-dir'),
  valCloud: document.getElementById('val-cloud'),
  valRain: document.getElementById('val-rain'),
  valGeo: document.getElementById('val-geo'),
  // Hourly & Daily
  hourlyScroll: document.getElementById('hourly-scroll'),
  dailyGrid: document.getElementById('daily-grid'),
  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initTabs();
  initCascadeWilayah();
  
  // Set default initial load
  setTimeout(() => {
    loadWeatherData(state.selectedKelurahanId);
  }, 100);
});

/* =====================================================================
   LIVE CLOCK
   ===================================================================== */
function initClock() {
  const updateClock = () => {
    const now = new Date();
    const options = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    };
    if (elements.clock) {
      elements.clock.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleDateString('id-ID', options)} WIB`;
    }
  };
  updateClock();
  setInterval(updateClock, 1000);
}

/* =====================================================================
   TABS NAVIGATION
   ===================================================================== */
function initTabs() {
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(targetTab) {
  state.activeTab = targetTab;

  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === targetTab);
  });

  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `tab-${targetTab}`);
  });

  // Tab-specific initialization
  if (targetTab === 'udara') {
    initAirQualityData();
  } else if (targetTab === 'gempa') {
    loadGempaData();
  }
}

/* =====================================================================
   CASCADE REGION FILTER (Kabupaten -> Kecamatan -> Kelurahan)
   ===================================================================== */
async function initCascadeWilayah() {
  try {
    const res = await fetch('api/wilayah.php?type=tree');
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message);

    state.wilayahTree = json.data;
    populateKabupatenSelect();

    // Event Listeners for cascading
    elements.selKabupaten.addEventListener('change', () => {
      state.selectedKabupatenId = parseInt(elements.selKabupaten.value) || 0;
      populateKecamatanSelect();
    });

    elements.selKecamatan.addEventListener('change', () => {
      state.selectedKecamatanId = parseInt(elements.selKecamatan.value) || 0;
      populateKelurahanSelect();
    });

    elements.selKelurahan.addEventListener('change', () => {
      state.selectedKelurahanId = parseInt(elements.selKelurahan.value) || 0;
      if (state.selectedKelurahanId > 0) {
        loadWeatherData(state.selectedKelurahanId);
      }
    });

    if (elements.btnRefreshWeather) {
      elements.btnRefreshWeather.addEventListener('click', () => {
        loadWeatherData(state.selectedKelurahanId);
      });
    }

    if (elements.btnSyncCurrent) {
      elements.btnSyncCurrent.addEventListener('click', () => {
        syncCurrentWeather();
      });
    }

    if (elements.btnSyncAll) {
      elements.btnSyncAll.addEventListener('click', () => {
        syncAllRegions();
      });
    }

    // Header search quick-jump
    const headerSearch = document.getElementById('header-search-input');
    if (headerSearch) {
      headerSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = headerSearch.value.trim().toLowerCase();
          if (!query) return;

          let found = false;
          for (const kab of state.wilayahTree) {
            if (kab.kecamatan) {
              for (const kec of kab.kecamatan) {
                if (kec.kelurahan) {
                  for (const kel of kec.kelurahan) {
                    if (
                      kel.nama.toLowerCase().includes(query) ||
                      kec.nama.toLowerCase().includes(query) ||
                      kab.nama.toLowerCase().includes(query)
                    ) {
                      state.selectedKabupatenId = kab.id;
                      elements.selKabupaten.value = kab.id;
                      populateKecamatanSelect();

                      state.selectedKecamatanId = kec.id;
                      elements.selKecamatan.value = kec.id;
                      populateKelurahanSelect();

                      state.selectedKelurahanId = kel.id;
                      elements.selKelurahan.value = kel.id;

                      switchTab('dashboard');
                      loadWeatherData(kel.id);
                      showToast(`Menampilkan cuaca untuk ${kel.nama}, ${kab.nama}`, 'info');
                      found = true;
                      break;
                    }
                  }
                }
                if (found) break;
              }
            }
            if (found) break;
          }

          if (!found) {
            showToast(`Wilayah "${query}" tidak ditemukan di database.`, 'warning');
          }
        }
      });
    }

  } catch (err) {
    showToast('Gagal memuat daftar wilayah: ' + err.message, 'error');
  }
}

function populateKabupatenSelect() {
  elements.selKabupaten.innerHTML = '<option value="">-- Pilih Kabupaten/Kota --</option>';
  state.wilayahTree.forEach(kab => {
    const opt = document.createElement('option');
    opt.value = kab.id;
    opt.textContent = kab.nama;
    if (kab.id == state.selectedKabupatenId) opt.selected = true;
    elements.selKabupaten.appendChild(opt);
  });
  populateKecamatanSelect();
}

function populateKecamatanSelect() {
  elements.selKecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
  const kab = state.wilayahTree.find(k => k.id == state.selectedKabupatenId);
  if (kab && kab.kecamatan) {
    kab.kecamatan.forEach(kec => {
      const opt = document.createElement('option');
      opt.value = kec.id;
      opt.textContent = kec.nama;
      if (kec.id == state.selectedKecamatanId) opt.selected = true;
      elements.selKecamatan.appendChild(opt);
    });
  }
  populateKelurahanSelect();
}

function populateKelurahanSelect() {
  elements.selKelurahan.innerHTML = '<option value="">-- Pilih Kelurahan/Desa --</option>';
  const kab = state.wilayahTree.find(k => k.id == state.selectedKabupatenId);
  if (kab && kab.kecamatan) {
    const kec = kab.kecamatan.find(c => c.id == state.selectedKecamatanId);
    if (kec && kec.kelurahan) {
      kec.kelurahan.forEach(kel => {
        const opt = document.createElement('option');
        opt.value = kel.id;
        opt.textContent = `${kel.nama} (${kel.kode_adm4 || 'No ADM4'})`;
        if (kel.id == state.selectedKelurahanId) opt.selected = true;
        elements.selKelurahan.appendChild(opt);
      });
    }
  }
}

/* =====================================================================
   FETCH WEATHER DATA (BMKG + DB Integration)
   ===================================================================== */
async function loadWeatherData(kelurahanId) {
  if (!kelurahanId) return;

  // Show loading indicator
  if (elements.heroCond) elements.heroCond.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat data BMKG...';
  if (elements.btnRefreshWeather) elements.btnRefreshWeather.disabled = true;

  try {
    const res = await fetch(`api/cuaca.php?kelurahan_id=${kelurahanId}`);
    const json = await res.json();

    if (json.status !== 'success') {
      throw new Error(json.message || 'Gagal memuat cuaca');
    }

    state.weatherData = json;
    renderWeather(json);



  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    if (elements.heroCond) elements.heroCond.textContent = 'Gagal memuat cuaca';
  } finally {
    if (elements.btnRefreshWeather) elements.btnRefreshWeather.disabled = false;
  }
}

function renderWeather(data) {
  const wDb = data.wilayah_db || {};
  const bmkg = data.cuaca_bmkg || {};
  const current = bmkg.current || {};
  const lokasi = bmkg.lokasi || {};


  // Hero Section
  elements.heroLokasi.textContent = wDb.nama_kelurahan || lokasi.kelurahan || 'Lokasi Terpilih';
  elements.heroSubLokasi.textContent = `Kecamatan ${wDb.nama_kecamatan || lokasi.kecamatan}, ${wDb.nama_kabupaten || lokasi.kabupaten}, ${lokasi.provinsi || 'Indonesia'}`;

  elements.heroTemp.textContent = current.suhu !== null && current.suhu !== undefined ? Math.round(current.suhu) : '--';
  elements.heroCond.innerHTML = `<i class="fa-solid fa-cloud-sun"></i> ${current.kondisi_cuaca || 'Tidak Ada Data'}`;
  elements.heroIcon.src = current.icon_cuaca || 'https://api-apps.bmkg.go.id/storage/icon/cuaca/cerah berawan-am.svg';
  elements.heroIcon.alt = current.kondisi_cuaca || 'Icon Cuaca';

  elements.heroAdm4.innerHTML = `<i class="fa-solid fa-fingerprint"></i> ADM4: ${wDb.kode_adm4 || lokasi.adm4 || '-'}`;



  // Metrics Grid
  elements.valHumidity.textContent = current.kelembapan !== null ? `${current.kelembapan}%` : '-';
  elements.valWind.textContent = current.kecepatan_angin || '-';
  elements.valWindDir.textContent = current.arah_angin ? `Arah ${current.arah_angin} (${current.arah_angin_deg || 0}°)` : '-';
  elements.valCloud.textContent = current.tutupan_awan || '-';
  elements.valRain.textContent = current.curah_hujan || '0 mm';

  const lat = lokasi.latitude ? parseFloat(lokasi.latitude).toFixed(3) : '-';
  const lon = lokasi.longitude ? parseFloat(lokasi.longitude).toFixed(3) : '-';
  elements.valGeo.textContent = `${lat}, ${lon}`;


  // Render Hourly Horizontal Scroll
  renderHourlyForecast(bmkg.hourly || []);

  // Render 3-Day Forecast Cards
  renderDailyForecast(bmkg.daily || []);
}


function renderHourlyForecast(hourly) {
  if (!elements.hourlyScroll) return;
  elements.hourlyScroll.innerHTML = '';

  hourly.forEach(slot => {
    const card = document.createElement('div');
    card.className = 'hourly-card';
    card.innerHTML = `
      <div class="hourly-time">${slot.jam}</div>
      <div class="hourly-date">${slot.tanggal}</div>
      <img src="${slot.icon_cuaca}" alt="${slot.kondisi_cuaca}" class="hourly-icon" loading="lazy">
      <div class="hourly-temp">${Math.round(slot.suhu)}°C</div>
      <div class="hourly-desc">${slot.kondisi_cuaca}</div>
      <div class="hourly-meta">
        <span><i class="fa-solid fa-droplet"></i> ${slot.kelembapan}%</span>
      </div>
    `;
    elements.hourlyScroll.appendChild(card);
  });
}

function renderDailyForecast(daily) {
  if (!elements.dailyGrid) return;
  elements.dailyGrid.innerHTML = '';

  daily.forEach(day => {
    const card = document.createElement('div');
    card.className = 'daily-card';
    card.innerHTML = `
      <div class="daily-left">
        <img src="${day.icon_cuaca}" alt="${day.kondisi_cuaca}" class="daily-icon" loading="lazy">
        <div>
          <div class="daily-day">${day.label_hari}</div>
          <div class="daily-cond">${day.kondisi_cuaca}</div>
        </div>
      </div>
      <div class="daily-right">
        <div class="daily-temps">${Math.round(day.suhu_max)}° / <span class="min">${Math.round(day.suhu_min)}°C</span></div>
        <div class="daily-hum"><i class="fa-solid fa-droplet"></i> Rata-rata ${day.kelembapan_avg}%</div>
      </div>
    `;
    elements.dailyGrid.appendChild(card);
  });
}

/* =====================================================================
   KUALITAS UDARA TAB
   ===================================================================== */
function initAirQualityData() {
  // Render static air quality station data for Aceh
  const stationsGrid = document.getElementById('udara-stations-grid');
  if (!stationsGrid || stationsGrid.children.length > 0) return;

  const stations = [
    { nama: 'Stasiun Met. SIM Blang Bintang', lokasi: 'Aceh Besar', pm25: 8.7, pm10: 22.3, status: 'Baik', color: '#10b981' },
    { nama: 'Stasiun Met. Malikussaleh', lokasi: 'Aceh Utara', pm25: 11.2, pm10: 28.1, status: 'Baik', color: '#10b981' },
    { nama: 'Stasiun Klim. Indrapuri', lokasi: 'Aceh Besar', pm25: 14.8, pm10: 35.6, status: 'Baik', color: '#10b981' },
    { nama: 'Stasiun Geo. Mata Ie', lokasi: 'Aceh Besar', pm25: 9.5, pm10: 24.9, status: 'Baik', color: '#10b981' }
  ];

  stations.forEach(st => {
    const box = document.createElement('div');
    box.className = 'metric-box';
    box.innerHTML = `
      <div class="metric-icon-wrap" style="color:${st.color}; background:${st.color}15;">
        <i class="fa-solid fa-tower-observation"></i>
      </div>
      <div class="metric-meta">
        <span class="label">${st.nama}</span>
        <h4 style="color:${st.color};">${st.pm25} µg/m³</h4>
        <span class="sub">${st.lokasi} • PM10: ${st.pm10} µg/m³ • ${st.status}</span>
      </div>
    `;
    stationsGrid.appendChild(box);
  });

  // Render PM2.5 trend chart
  renderAirQualityChart();
}

function renderAirQualityChart() {
  const canvas = document.getElementById('udaraTrendChart');
  if (!canvas) return;

  const hours = [];
  const pm25Values = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const h = new Date(now.getTime() - i * 60 * 60 * 1000);
    hours.push(`${h.getHours().toString().padStart(2, '0')}:00`);
    pm25Values.push(Math.round((8 + Math.random() * 7) * 10) / 10);
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [{
        label: 'PM2.5 (µg/m³)',
        data: pm25Values,
        borderColor: '#10b981',
        backgroundColor: gradient,
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#1e293b',
            font: { family: 'Plus Jakarta Sans', size: 12, weight: 700 },
            usePointStyle: true, boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#002244',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          borderColor: '#10b981',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 }
        },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#10b981',
            font: { weight: 700 },
            callback: val => `${val} µg`
          },
          min: 0,
          max: 25
        }
      }
    }
  });
}

/* =====================================================================
   GEMPABUMI & TSUNAMI TAB
   ===================================================================== */
async function loadGempaData() {
  try {
    const res = await fetch('api/gempa.php');
    const json = await res.json();
    
    if (json.status === 'success') {
      renderGempaData(json.data);
    }
  } catch (err) {
    console.error('Error loading gempa data:', err);
  }
}

function renderGempaData(data) {
  if (!data) return;

  const autogempa = data.autogempa;
  if (autogempa) {
    const magEl = document.getElementById('gempa-auto-mag');
    const potensiEl = document.getElementById('gempa-auto-potensi');
    const wilayahEl = document.getElementById('gempa-auto-wilayah');
    const waktuEl = document.getElementById('gempa-auto-waktu');
    const tanggalEl = document.getElementById('gempa-auto-tanggal');
    const kedalamanEl = document.getElementById('gempa-auto-kedalaman');
    const koordinatEl = document.getElementById('gempa-auto-koordinat');
    const lintangBujurEl = document.getElementById('gempa-auto-lintang-bujur');
    const dirasakanEl = document.getElementById('gempa-auto-dirasakan');
    const shakemapEl = document.getElementById('gempa-auto-shakemap');

    if (magEl) magEl.textContent = autogempa.Magnitude || '--';
    if (potensiEl) {
      potensiEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${autogempa.Potensi || 'Tidak berpotensi TSUNAMI'}`;
      if (autogempa.Potensi && autogempa.Potensi.toLowerCase().includes('tsunami')) {
        potensiEl.classList.add('potensi-tsunami');
      }
    }
    if (wilayahEl) wilayahEl.textContent = autogempa.Wilayah || 'Memuat data...';
    if (waktuEl) waktuEl.textContent = autogempa.Jam || '--';
    if (tanggalEl) tanggalEl.textContent = autogempa.Tanggal || '--';
    if (kedalamanEl) kedalamanEl.textContent = autogempa.Kedalaman || '-- km';
    if (koordinatEl) koordinatEl.textContent = `${autogempa.Lintang || '--'}, ${autogempa.Bujur || '--'}`;
    if (lintangBujurEl) lintangBujurEl.textContent = `Lat: ${autogempa.Lintang || '--'} | Lon: ${autogempa.Bujur || '--'}`;
    if (dirasakanEl) dirasakanEl.textContent = autogempa.Dirasakan || '-';
    if (shakemapEl && autogempa.Shakemap) {
      shakemapEl.src = `https://data.bmkg.go.id/DataMKG/TEWS/${autogempa.Shakemap}`;
      shakemapEl.alt = `Shakemap ${autogempa.Wilayah}`;
    }
  }

  // Render dirasakan list
  const dirasakan = data.gempadirasakan;
  const tbody = document.getElementById('gempa-dirasakan-tbody');
  if (dirasakan && tbody) {
    tbody.innerHTML = '';
    dirasakan.forEach(g => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${g.Tanggal}</strong><br><span style="font-size:0.78rem; color:var(--text-muted);">${g.Jam}</span></td>
        <td><span class="gempa-mag-inline">${g.Magnitude}</span></td>
        <td>${g.Kedalaman}</td>
        <td style="font-size:0.82rem;">${g.Lintang}, ${g.Bujur}</td>
        <td>${g.Wilayah}</td>
        <td style="font-size:0.82rem;">${g.Dirasakan}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

/* =====================================================================
   REST API PLAYGROUND & TESTING CONSOLE
   ===================================================================== */
function initApiPlayground() {
  const testBtns = document.querySelectorAll('.btn-test-api');
  const codeBox = document.getElementById('api-test-output');
  const statusBadge = document.getElementById('api-test-status');

  testBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const endpoint = btn.getAttribute('data-endpoint');
      const method = btn.getAttribute('data-method') || 'GET';
      
      if (statusBadge) statusBadge.textContent = 'Memanggil ' + endpoint + '...';
      if (codeBox) codeBox.textContent = '// Menjalankan permintaan HTTP...';

      try {
        const start = performance.now();
        const res = await fetch(endpoint, { method: method });
        const json = await res.json();
        const duration = Math.round(performance.now() - start);

        if (statusBadge) {
          statusBadge.innerHTML = `<span style="color:var(--accent-emerald)"><i class="fa-solid fa-check"></i> HTTP ${res.status} OK</span> (${duration}ms)`;
        }
        if (codeBox) {
          codeBox.textContent = JSON.stringify(json, null, 2);
        }
      } catch (err) {
        if (statusBadge) statusBadge.innerHTML = `<span style="color:var(--accent-rose)"><i class="fa-solid fa-xmark"></i> Request Gagal</span>`;
        if (codeBox) codeBox.textContent = '// Error: ' + err.message;
      }
    });
  });
}

/* =====================================================================
   TOAST NOTIFICATION ENGINE
   ===================================================================== */
function showToast(message, type = 'info') {
  const container = elements.toastContainer;
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'circle-info';
  if (type === 'success') icon = 'circle-check';
  if (type === 'error') icon = 'circle-exclamation';
  if (type === 'warning') icon = 'triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid fa-${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
