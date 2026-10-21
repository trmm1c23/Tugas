<?php
/**
 * REST API: Manajemen & Cascade Data Wilayah
 * Mendukung pembacaan berjenjang (Kabupaten -> Kecamatan -> Kelurahan)
 * dan CRUD penambahan data wilayah baru
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDb();
    $method = $_SERVER['REQUEST_METHOD'];

    // ==========================================
    // GET: Query Wilayah
    // ==========================================
    if ($method === 'GET') {
        $type = $_GET['type'] ?? 'tree';

        if ($type === 'tree') {
            // Ambil seluruh struktur berjenjang
            $stmt = $pdo->query("
                SELECT 
                    k.id AS kabupaten_id,
                    k.nama_kabupaten,
                    c.id AS kecamatan_id,
                    c.nama_kecamatan,
                    l.id AS kelurahan_id,
                    l.nama_kelurahan,
                    l.kode_adm4
                FROM kabupaten_kota k
                LEFT JOIN kecamatan c ON c.kabupaten_id = k.id
                LEFT JOIN kelurahan_desa l ON l.kecamatan_id = c.id
                ORDER BY k.nama_kabupaten ASC, c.nama_kecamatan ASC, l.nama_kelurahan ASC
            ");
            $rows = $stmt->fetchAll();

            $tree = [];
            foreach ($rows as $row) {
                $kabId = $row['kabupaten_id'];
                if (!isset($tree[$kabId])) {
                    $tree[$kabId] = [
                        'id' => $kabId,
                        'nama' => $row['nama_kabupaten'],
                        'kecamatan' => []
                    ];
                }

                if ($row['kecamatan_id']) {
                    $kecId = $row['kecamatan_id'];
                    if (!isset($tree[$kabId]['kecamatan'][$kecId])) {
                        $tree[$kabId]['kecamatan'][$kecId] = [
                            'id' => $kecId,
                            'nama' => $row['nama_kecamatan'],
                            'kelurahan' => []
                        ];
                    }

                    if ($row['kelurahan_id']) {
                        $tree[$kabId]['kecamatan'][$kecId]['kelurahan'][] = [
                            'id' => $row['kelurahan_id'],
                            'nama' => $row['nama_kelurahan'],
                            'kode_adm4' => $row['kode_adm4']
                        ];
                    }
                }
            }

            // Normalisasi array numerik
            $output = [];
            foreach ($tree as $kab) {
                $kab['kecamatan'] = array_values($kab['kecamatan']);
                $output[] = $kab;
            }

            echo json_encode(['status' => 'success', 'data' => $output], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($type === 'kabupaten') {
            $stmt = $pdo->query("SELECT id, nama_kabupaten FROM kabupaten_kota ORDER BY nama_kabupaten ASC");
            echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()], JSON_PRETTY_PRINT);
            exit;
        }

        if ($type === 'kecamatan') {
            $kabId = (int)($_GET['kabupaten_id'] ?? 0);
            if ($kabId > 0) {
                $stmt = $pdo->prepare("SELECT id, kabupaten_id, nama_kecamatan FROM kecamatan WHERE kabupaten_id = :kid ORDER BY nama_kecamatan ASC");
                $stmt->execute(['kid' => $kabId]);
            } else {
                $stmt = $pdo->query("SELECT id, kabupaten_id, nama_kecamatan FROM kecamatan ORDER BY nama_kecamatan ASC");
            }
            echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()], JSON_PRETTY_PRINT);
            exit;
        }

        if ($type === 'kelurahan') {
            $kecId = (int)($_GET['kecamatan_id'] ?? 0);
            if ($kecId > 0) {
                $stmt = $pdo->prepare("SELECT id, kecamatan_id, nama_kelurahan, kode_adm4 FROM kelurahan_desa WHERE kecamatan_id = :kid ORDER BY nama_kelurahan ASC");
                $stmt->execute(['kid' => $kecId]);
            } else {
                $stmt = $pdo->query("SELECT id, kecamatan_id, nama_kelurahan, kode_adm4 FROM kelurahan_desa ORDER BY nama_kelurahan ASC");
            }
            echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()], JSON_PRETTY_PRINT);
            exit;
        }

        throw new InvalidArgumentException("Tipe query wilayah tidak valid.");
    }

    // ==========================================
    // POST: Tambah Data Wilayah
    // ==========================================
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? $_POST;
        $action = $body['action'] ?? '';

        if ($action === 'add_kabupaten') {
            $nama = trim($body['nama_kabupaten'] ?? '');
            if (empty($nama)) throw new Exception("Nama kabupaten/kota tidak boleh kosong.");

            $stmt = $pdo->prepare("INSERT INTO kabupaten_kota (nama_kabupaten) VALUES (:nama)");
            $stmt->execute(['nama' => $nama]);
            echo json_encode(['status' => 'success', 'message' => "Kabupaten/Kota '{$nama}' berhasil ditambahkan.", 'id' => $pdo->lastInsertId()]);
            exit;
        }

        if ($action === 'add_kecamatan') {
            $kabId = (int)($body['kabupaten_id'] ?? 0);
            $nama = trim($body['nama_kecamatan'] ?? '');
            if ($kabId <= 0) throw new Exception("Pilih kabupaten terlebih dahulu.");
            if (empty($nama)) throw new Exception("Nama kecamatan tidak boleh kosong.");

            $stmt = $pdo->prepare("INSERT INTO kecamatan (kabupaten_id, nama_kecamatan) VALUES (:kid, :nama)");
            $stmt->execute(['kid' => $kabId, 'nama' => $nama]);
            echo json_encode(['status' => 'success', 'message' => "Kecamatan '{$nama}' berhasil ditambahkan.", 'id' => $pdo->lastInsertId()]);
            exit;
        }

        if ($action === 'add_kelurahan') {
            $kecId = (int)($body['kecamatan_id'] ?? 0);
            $nama = trim($body['nama_kelurahan'] ?? '');
            $adm4 = trim($body['kode_adm4'] ?? '');

            if ($kecId <= 0) throw new Exception("Pilih kecamatan terlebih dahulu.");
            if (empty($nama)) throw new Exception("Nama kelurahan tidak boleh kosong.");
            if (empty($adm4)) throw new Exception("Kode ADM4 BMKG wajib diisi agar cuaca dapat disinkronkan.");

            $stmt = $pdo->prepare("INSERT INTO kelurahan_desa (kecamatan_id, nama_kelurahan, kode_adm4) VALUES (:kid, :nama, :adm4)");
            $stmt->execute(['kid' => $kecId, 'nama' => $nama, 'adm4' => $adm4]);
            echo json_encode(['status' => 'success', 'message' => "Kelurahan/Desa '{$nama}' berhasil ditambahkan.", 'id' => $pdo->lastInsertId()]);
            exit;
        }

        throw new InvalidArgumentException("Action POST tidak valid.");
    }

    // ==========================================
    // DELETE: Hapus Data Wilayah
    // ==========================================
    if ($method === 'DELETE') {
        $type = $_GET['type'] ?? '';
        $id = (int)($_GET['id'] ?? 0);

        if ($id <= 0) throw new Exception("ID wilayah tidak valid.");

        if ($type === 'kabupaten') {
            $stmt = $pdo->prepare("DELETE FROM kabupaten_kota WHERE id = :id");
            $stmt->execute(['id' => $id]);
            echo json_encode(['status' => 'success', 'message' => "Kabupaten berhasil dihapus beserta kecamatan & desa terkait."]);
            exit;
        }

        if ($type === 'kecamatan') {
            $stmt = $pdo->prepare("DELETE FROM kecamatan WHERE id = :id");
            $stmt->execute(['id' => $id]);
            echo json_encode(['status' => 'success', 'message' => "Kecamatan berhasil dihapus beserta kelurahan terkait."]);
            exit;
        }

        if ($type === 'kelurahan') {
            $stmt = $pdo->prepare("DELETE FROM kelurahan_desa WHERE id = :id");
            $stmt->execute(['id' => $id]);
            echo json_encode(['status' => 'success', 'message' => "Kelurahan berhasil dihapus."]);
            exit;
        }

        throw new InvalidArgumentException("Tipe penghapusan tidak valid.");
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
