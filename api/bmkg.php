<?php
/**
 * BMKG API Client & Parser
 * Mengambil data prakiraan cuaca terbuka dari API BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)
 * Menggunakan endpoint ADM4: https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_adm4}
 */

/**
 * Fetch raw weather data from BMKG API by ADM4 code
 *
 * @param string $adm4 Kode ADM4 wilayah (contoh: 11.73.02.2017)
 * @return array
 * @throws Exception
 */
function fetchBmkgWeather(string $adm4): array {
    $adm4 = trim($adm4);
    if (empty($adm4)) {
        throw new InvalidArgumentException("Kode ADM4 tidak boleh kosong.");
    }

    $url = "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=" . urlencode($adm4);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 7,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false, // Memastikan kompatibel di lokal Windows/Laragon
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'User-Agent: Sistem-Terintegrasi-Cuaca/1.0 (Universitas; Sistem Terintegrasi BMKG)'
        ]
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || !empty($curlError)) {
        throw new RuntimeException("Koneksi ke API BMKG gagal: " . ($curlError ?: 'Unknown cURL error'));
    }

    if ($httpCode === 404) {
        throw new RuntimeException("Data cuaca untuk kode ADM4 [{$adm4}] tidak ditemukan di BMKG (404 Not Found).");
    }

    if ($httpCode !== 200) {
        throw new RuntimeException("API BMKG mengembalikan respon HTTP {$httpCode}.");
    }

    $json = json_decode($response, true);
    if (!is_array($json)) {
        throw new RuntimeException("Gagal mengurai respon JSON dari API BMKG.");
    }

    return parseBmkgWeatherResponse($json, $adm4);
}

/**
 * Parse & structure BMKG API response into clean UI-ready format
 *
 * @param array $json Respon asli dari BMKG
 * @param string $adm4
 * @return array
 */
function parseBmkgWeatherResponse(array $json, string $adm4): array {
    $lokasi = $json['lokasi'] ?? [];
    $dataBlock = $json['data'][0] ?? [];
    $cuacaDays = $dataBlock['cuaca'] ?? [];

    if (empty($cuacaDays)) {
        throw new RuntimeException("Data cuaca tidak tersedia untuk wilayah ini.");
    }

    // Ratakan seluruh time slots 3-jaman dari BMKG
    $allSlots = [];
    $dailyGroups = [];

    foreach ($cuacaDays as $dayIndex => $daySlots) {
        if (!is_array($daySlots)) continue;

        $dayDateKey = null;
        $dayTemps = [];
        $dayHumidities = [];
        $dayDescriptions = [];

        foreach ($daySlots as $slot) {
            $localTimeStr = $slot['local_datetime'] ?? $slot['datetime'] ?? '';
            $ts = strtotime($localTimeStr);
            if (!$ts) {
                $ts = strtotime($slot['datetime'] ?? 'now');
            }

            $dateKey = date('Y-m-d', $ts);
            if (!$dayDateKey) {
                $dayDateKey = $dateKey;
            }

            $formattedSlot = [
                'datetime'         => $slot['datetime'] ?? '',
                'local_datetime'   => $localTimeStr,
                'timestamp'        => $ts,
                'jam'              => date('H:i', $ts),
                'tanggal'          => date('d M Y', $ts),
                'suhu'             => isset($slot['t']) ? (float)$slot['t'] : null,
                'kelembapan'       => isset($slot['hu']) ? (int)$slot['hu'] : null,
                'kondisi_cuaca'    => $slot['weather_desc'] ?? 'Tidak Diketahui',
                'kondisi_cuaca_en' => $slot['weather_desc_en'] ?? '',
                'weather_code'     => $slot['weather'] ?? null,
                'kecepatan_angin'  => isset($slot['ws']) ? ($slot['ws'] . ' km/jam') : '-',
                'kecepatan_angin_val' => $slot['ws'] ?? 0,
                'arah_angin'       => $slot['wd'] ?? '-',
                'arah_angin_deg'   => $slot['wd_deg'] ?? null,
                'tutupan_awan'     => isset($slot['tcc']) ? ($slot['tcc'] . '%') : '-',
                'tutupan_awan_val' => $slot['tcc'] ?? null,
                'curah_hujan'      => isset($slot['tp']) ? ($slot['tp'] . ' mm') : '0 mm',
                'icon_cuaca'       => $slot['image'] ?? 'https://api-apps.bmkg.go.id/storage/icon/cuaca/cerah-am.svg'
            ];

            $allSlots[] = $formattedSlot;

            if (isset($slot['t'])) $dayTemps[] = (float)$slot['t'];
            if (isset($slot['hu'])) $dayHumidities[] = (int)$slot['hu'];
            if (!empty($slot['weather_desc'])) $dayDescriptions[] = $slot['weather_desc'];
        }

        // Hitung ringkasan harian
        if (!empty($dayTemps)) {
            // Temukan cuaca paling sering muncul pada hari tersebut
            $descCounts = array_count_values($dayDescriptions);
            arsort($descCounts);
            $dominantDesc = array_key_first($descCounts) ?? 'Cerah Berawan';

            // Ambil icon cuaca siang/tengah hari jika ada
            $midSlot = $daySlots[floor(count($daySlots) / 2)] ?? ($daySlots[0] ?? []);
            $dominantIcon = $midSlot['image'] ?? 'https://api-apps.bmkg.go.id/storage/icon/cuaca/cerah berawan-am.svg';

            $dailyGroups[] = [
                'tanggal'       => $dayDateKey,
                'label_hari'    => formatHariIndonesia($dayDateKey),
                'suhu_min'      => min($dayTemps),
                'suhu_max'      => max($dayTemps),
                'suhu_avg'      => round(array_sum($dayTemps) / count($dayTemps), 1),
                'kelembapan_avg'=> round(array_sum($dayHumidities) / max(1, count($dayHumidities))),
                'kondisi_cuaca' => $dominantDesc,
                'icon_cuaca'    => $dominantIcon
            ];
        }
    }

    // Urutkan slot berdasarkan timestamp
    usort($allSlots, fn($a, $b) => $a['timestamp'] <=> $b['timestamp']);

    // Tentukan "Current Weather" (paling mendekati waktu sekarang)
    $now = time();
    $currentSlot = null;
    $minDiff = PHP_INT_MAX;

    foreach ($allSlots as $slot) {
        $diff = abs($slot['timestamp'] - $now);
        if ($diff < $minDiff) {
            $minDiff = $diff;
            $currentSlot = $slot;
        }
    }

    if (!$currentSlot && !empty($allSlots)) {
        $currentSlot = $allSlots[0];
    }

    return [
        'status'         => 'success',
        'sumber'         => 'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)',
        'waktu_diambil'  => date('Y-m-d H:i:s'),
        'lokasi'         => [
            'adm1'       => $lokasi['adm1'] ?? '',
            'adm2'       => $lokasi['adm2'] ?? '',
            'adm3'       => $lokasi['adm3'] ?? '',
            'adm4'       => $lokasi['adm4'] ?? $adm4,
            'provinsi'   => $lokasi['provinsi'] ?? '',
            'kabupaten'  => $lokasi['kotkab'] ?? '',
            'kecamatan'  => $lokasi['kecamatan'] ?? '',
            'kelurahan'  => $lokasi['desa'] ?? '',
            'latitude'   => $lokasi['lat'] ?? null,
            'longitude'  => $lokasi['lon'] ?? null,
            'timezone'   => $lokasi['timezone'] ?? 'Asia/Jakarta'
        ],
        'current'        => $currentSlot,
        'hourly'         => array_slice($allSlots, 0, 16), // Prakiraan 48 jam ke depan (16 slot x 3 jam)
        'daily'          => $dailyGroups,
        'raw_slots_count'=> count($allSlots)
    ];
}

/**
 * Format tanggal Y-m-d ke nama hari & tanggal bahasa Indonesia
 *
 * @param string $dateStr
 * @return string
 */
function formatHariIndonesia(string $dateStr): string {
    $ts = strtotime($dateStr);
    $hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    $bulan = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    $today = date('Y-m-d');
    $tomorrow = date('Y-m-d', strtotime('+1 day'));

    if ($dateStr === $today) {
        return 'Hari Ini (' . date('j', $ts) . ' ' . $bulan[(int)date('n', $ts)] . ')';
    } elseif ($dateStr === $tomorrow) {
        return 'Besok (' . date('j', $ts) . ' ' . $bulan[(int)date('n', $ts)] . ')';
    }

    $namaHari = $hari[(int)date('w', $ts)];
    return $namaHari . ', ' . date('j', $ts) . ' ' . $bulan[(int)date('n', $ts)];
}
