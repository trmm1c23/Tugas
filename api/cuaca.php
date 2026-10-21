<?php
/**
 * REST API: Cuaca Terintegrasi (BMKG + MySQL db_sistem_terintegrasi)
 * GET /api/cuaca.php?kelurahan_id=1
 * GET /api/cuaca.php?adm4=11.73.02.2017
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/bmkg.php';

try {
    $pdo = getDb();

    $kelurahanId = isset($_GET['kelurahan_id']) ? (int)$_GET['kelurahan_id'] : 0;
    $adm4 = isset($_GET['adm4']) ? trim($_GET['adm4']) : '';

    $kelurahanInfo = null;

    // Jika kelurahan_id diberikan, ambil dari database
    if ($kelurahanId > 0) {
        $stmt = $pdo->prepare("
            SELECT 
                l.id AS kelurahan_id,
                l.nama_kelurahan,
                l.kode_adm4,
                c.id AS kecamatan_id,
                c.nama_kecamatan,
                k.id AS kabupaten_id,
                k.nama_kabupaten
            FROM kelurahan_desa l
            JOIN kecamatan c ON l.kecamatan_id = c.id
            JOIN kabupaten_kota k ON c.kabupaten_id = k.id
            WHERE l.id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $kelurahanId]);
        $kelurahanInfo = $stmt->fetch();

        if ($kelurahanInfo) {
            $adm4 = $kelurahanInfo['kode_adm4'] ?: $adm4;
        }
    }

    // Jika belum ada ID atau adm4, default ke data pertama di database
    if (empty($adm4) && !$kelurahanInfo) {
        $stmt = $pdo->query("
            SELECT 
                l.id AS kelurahan_id,
                l.nama_kelurahan,
                l.kode_adm4,
                c.id AS kecamatan_id,
                c.nama_kecamatan,
                k.id AS kabupaten_id,
                k.nama_kabupaten
            FROM kelurahan_desa l
            JOIN kecamatan c ON l.kecamatan_id = c.id
            JOIN kabupaten_kota k ON c.kabupaten_id = k.id
            ORDER BY l.id ASC
            LIMIT 1
        ");
        $kelurahanInfo = $stmt->fetch();
        if ($kelurahanInfo) {
            $kelurahanId = (int)$kelurahanInfo['kelurahan_id'];
            $adm4 = $kelurahanInfo['kode_adm4'];
        }
    }

    if (empty($adm4)) {
        throw new Exception("Kode ADM4 BMKG belum disetel untuk kelurahan ini. Silakan lengkapi pada menu Manajemen Wilayah.");
    }

    // 1. Ambil data cuaca realtime & prakiraan dari API BMKG
    $bmkgData = fetchBmkgWeather($adm4);

    // 2. Simpan / Perbarui secara otomatis ke tabel data_cuaca di db_sistem_terintegrasi
    if ($kelurahanId > 0 && isset($bmkgData['current'])) {
        $cur = $bmkgData['current'];
        try {
            $syncStmt = $pdo->prepare("
                INSERT INTO data_cuaca (
                    kelurahan_id, kondisi_cuaca, suhu, kelembapan, kecepatan_angin, arah_angin, icon_cuaca, tanggal_update
                ) VALUES (
                    :kid, :kondisi, :suhu, :kelembapan, :angin, :arah, :icon, NOW()
                )
            ");
            $syncStmt->execute([
                'kid'        => $kelurahanId,
                'kondisi'    => $cur['kondisi_cuaca'] ?? null,
                'suhu'       => $cur['suhu'] ?? null,
                'kelembapan' => $cur['kelembapan'] ?? null,
                'angin'      => $cur['kecepatan_angin'] ?? null,
                'arah'       => $cur['arah_angin'] ?? null,
                'icon'       => $cur['icon_cuaca'] ?? null
            ]);
        } catch (Exception $ignored) {
            // Abaikan agar respon cuaca tetap lancar
        }
    }

    // 3. Susun respon integrasi
    echo json_encode([
        'status'         => 'success',
        'wilayah_db'     => $kelurahanInfo,
        'cuaca_bmkg'     => $bmkgData
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
