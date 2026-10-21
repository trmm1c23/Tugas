<?php
/**
 * REST API: Riwayat Log Cuaca Tersimpan di Database (data_cuaca)
 * GET /api/history.php
 * GET /api/history.php?format=csv
 * DELETE /api/history.php?id=1
 * DELETE /api/history.php?action=clear_all
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDb();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $format = $_GET['format'] ?? 'json';
        $search = trim($_GET['search'] ?? '');
        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $kelurahanId = isset($_GET['kelurahan_id']) ? (int)$_GET['kelurahan_id'] : 0;

        $where = [];
        $params = [];

        if ($kelurahanId > 0) {
            $where[] = "d.kelurahan_id = :kid";
            $params['kid'] = $kelurahanId;
        }

        if (!empty($search)) {
            $where[] = "(l.nama_kelurahan LIKE :s OR c.nama_kecamatan LIKE :s OR k.nama_kabupaten LIKE :s OR d.kondisi_cuaca LIKE :s)";
            $params['s'] = "%{$search}%";
        }

        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        $sql = "
            SELECT 
                d.id,
                d.kelurahan_id,
                l.nama_kelurahan,
                l.kode_adm4,
                c.nama_kecamatan,
                k.nama_kabupaten,
                d.kondisi_cuaca,
                d.suhu,
                d.kelembapan,
                d.kecepatan_angin,
                d.arah_angin,
                d.icon_cuaca,
                d.tanggal_update
            FROM data_cuaca d
            JOIN kelurahan_desa l ON d.kelurahan_id = l.id
            JOIN kecamatan c ON l.kecamatan_id = c.id
            JOIN kabupaten_kota k ON c.kabupaten_id = k.id
            {$whereClause}
            ORDER BY d.tanggal_update DESC, d.id DESC
            LIMIT {$limit}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll();

        // Jika minta format CSV
        if ($format === 'csv') {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="riwayat_cuaca_bmkg_' . date('Ymd_His') . '.csv"');

            $output = fopen('php://output', 'w');
            // UTF-8 BOM untuk Excel
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($output, ['ID', 'Kabupaten/Kota', 'Kecamatan', 'Kelurahan/Desa', 'Kode ADM4', 'Kondisi Cuaca', 'Suhu (°C)', 'Kelembapan (%)', 'Kecepatan Angin', 'Arah Angin', 'Tanggal Update']);

            foreach ($logs as $row) {
                fputcsv($output, [
                    $row['id'],
                    $row['nama_kabupaten'],
                    $row['nama_kecamatan'],
                    $row['nama_kelurahan'],
                    $row['kode_adm4'],
                    $row['kondisi_cuaca'],
                    $row['suhu'],
                    $row['kelembapan'],
                    $row['kecepatan_angin'] ?? '-',
                    $row['arah_angin'] ?? '-',
                    $row['tanggal_update']
                ]);
            }
            fclose($output);
            exit;
        }

        // Hitung statistik agregat
        $statsStmt = $pdo->query("
            SELECT 
                COUNT(*) AS total_records,
                COUNT(DISTINCT kelurahan_id) AS total_kelurahan_aktif,
                ROUND(AVG(suhu), 1) AS avg_suhu,
                MIN(suhu) AS min_suhu,
                MAX(suhu) AS max_suhu,
                ROUND(AVG(kelembapan)) AS avg_kelembapan,
                MAX(tanggal_update) AS last_sync
            FROM data_cuaca
        ");
        $stats = $statsStmt->fetch();

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'stats'  => $stats,
            'count'  => count($logs),
            'data'   => $logs
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'DELETE') {
        header('Content-Type: application/json; charset=utf-8');
        $id = (int)($_GET['id'] ?? 0);
        $action = $_GET['action'] ?? '';

        if ($action === 'clear_all') {
            $pdo->exec("TRUNCATE TABLE data_cuaca");
            echo json_encode(['status' => 'success', 'message' => "Seluruh riwayat cuaca berhasil dibersihkan."]);
            exit;
        }

        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM data_cuaca WHERE id = :id");
            $stmt->execute(['id' => $id]);
            echo json_encode(['status' => 'success', 'message' => "Record riwayat #{$id} berhasil dihapus."]);
            exit;
        }

        throw new InvalidArgumentException("ID riwayat tidak valid.");
    }

} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
