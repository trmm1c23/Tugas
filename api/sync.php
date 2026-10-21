<?php
/**
 * REST API: Sinkronisasi Data Cuaca BMKG ke Database MySQL (db_sistem_terintegrasi)
 * POST /api/sync.php
 * Body: { "kelurahan_id": 1 } ATAU { "sync_all": true }
 * Mendukung juga GET /api/sync.php?kelurahan_id=1 untuk kemudahan testing
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/bmkg.php';

try {
    $pdo = getDb();

    // Dapatkan parameter dari JSON body atau query string
    $input = [];
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded)) {
            $input = $decoded;
        }
    }

    $kelurahanId = isset($input['kelurahan_id']) ? (int)$input['kelurahan_id'] : (isset($_GET['kelurahan_id']) ? (int)$_GET['kelurahan_id'] : 0);
    $syncAll = isset($input['sync_all']) ? (bool)$input['sync_all'] : (isset($_GET['sync_all']) && $_GET['sync_all'] === 'true');

    if ($kelurahanId <= 0 && !$syncAll) {
        throw new InvalidArgumentException("Harap tentukan 'kelurahan_id' atau 'sync_all': true.");
    }

    // Ambil daftar kelurahan yang akan disinkronkan
    if ($syncAll) {
        $stmt = $pdo->query("
            SELECT 
                l.id AS kelurahan_id,
                l.nama_kelurahan,
                l.kode_adm4,
                c.nama_kecamatan,
                k.nama_kabupaten
            FROM kelurahan_desa l
            JOIN kecamatan c ON l.kecamatan_id = c.id
            JOIN kabupaten_kota k ON c.kabupaten_id = k.id
            WHERE l.kode_adm4 IS NOT NULL AND l.kode_adm4 != ''
            ORDER BY l.id ASC
        ");
        $targets = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare("
            SELECT 
                l.id AS kelurahan_id,
                l.nama_kelurahan,
                l.kode_adm4,
                c.nama_kecamatan,
                k.nama_kabupaten
            FROM kelurahan_desa l
            JOIN kecamatan c ON l.kecamatan_id = c.id
            JOIN kabupaten_kota k ON c.kabupaten_id = k.id
            WHERE l.id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $kelurahanId]);
        $targets = $stmt->fetchAll();
    }

    if (empty($targets)) {
        throw new RuntimeException("Tidak ada data kelurahan dengan kode ADM4 yang valid untuk disinkronkan.");
    }

    $results = [];
    $errors = [];

    $insertStmt = $pdo->prepare("
        INSERT INTO data_cuaca (
            kelurahan_id,
            kondisi_cuaca,
            suhu,
            kelembapan,
            kecepatan_angin,
            arah_angin,
            icon_cuaca,
            tanggal_update
        ) VALUES (
            :kelurahan_id,
            :kondisi_cuaca,
            :suhu,
            :kelembapan,
            :kecepatan_angin,
            :arah_angin,
            :icon_cuaca,
            NOW()
        )
    ");

    foreach ($targets as $target) {
        $kId = (int)$target['kelurahan_id'];
        $adm4 = trim($target['kode_adm4']);
        $namaLengkap = "{$target['nama_kelurahan']}, {$target['nama_kecamatan']}, {$target['nama_kabupaten']}";

        try {
            // Ambil dari BMKG
            $bmkg = fetchBmkgWeather($adm4);
            $current = $bmkg['current'] ?? null;

            if (!$current) {
                throw new Exception("Tidak ada blok data cuaca realtime dari BMKG.");
            }

            // Simpan ke database
            $insertStmt->execute([
                'kelurahan_id'    => $kId,
                'kondisi_cuaca'   => $current['kondisi_cuaca'] ?? 'Tidak Diketahui',
                'suhu'            => $current['suhu'],
                'kelembapan'      => $current['kelembapan'],
                'kecepatan_angin' => $current['kecepatan_angin'] ?? null,
                'arah_angin'      => $current['arah_angin'] ?? null,
                'icon_cuaca'      => $current['icon_cuaca'] ?? null
            ]);

            $newInsertId = (int)$pdo->lastInsertId();

            $results[] = [
                'insert_id'      => $newInsertId,
                'kelurahan_id'   => $kId,
                'nama_wilayah'   => $namaLengkap,
                'kode_adm4'      => $adm4,
                'suhu'           => $current['suhu'],
                'kelembapan'     => $current['kelembapan'],
                'kondisi_cuaca'  => $current['kondisi_cuaca'],
                'kecepatan_angin'=> $current['kecepatan_angin'],
                'icon_cuaca'     => $current['icon_cuaca'],
                'tanggal_update' => date('Y-m-d H:i:s')
            ];

            // Tambahkan jeda sangat singkat jika sync_all agar ramah rate limit BMKG
            if ($syncAll) {
                usleep(200000); // 0.2 detik
            }

        } catch (Exception $e) {
            $errors[] = [
                'kelurahan_id' => $kId,
                'nama_wilayah' => $namaLengkap,
                'error'        => $e->getMessage()
            ];
        }
    }

    echo json_encode([
        'status'         => (count($results) > 0) ? 'success' : 'error',
        'message'        => 'Sinkronisasi cuaca BMKG selesai.',
        'synced_count'   => count($results),
        'failed_count'   => count($errors),
        'data'           => $results,
        'errors'         => $errors
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
