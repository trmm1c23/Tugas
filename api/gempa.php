<?php
/**
 * REST API: Data Gempabumi BMKG Terkini & Dirasakan
 * Sumber: https://data.bmkg.go.id/DataMKG/TEWS/
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    // 1. Ambil gempa terbaru (autogempa)
    $ch1 = curl_init('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
    curl_setopt_array($ch1, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'BMKG-Portal/1.0'
    ]);
    $rawAuto = curl_exec($ch1);
    curl_close($ch1);

    $autoJson = json_decode($rawAuto, true);
    $autoGempa = $autoJson['Infogempa']['gempa'] ?? null;

    if ($autoGempa && !empty($autoGempa['Shakemap'])) {
        $autoGempa['ShakemapUrl'] = 'https://data.bmkg.go.id/DataMKG/TEWS/' . $autoGempa['Shakemap'];
    }

    // 2. Ambil 15 gempa dirasakan
    $ch2 = curl_init('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json');
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'BMKG-Portal/1.0'
    ]);
    $rawDirasakan = curl_exec($ch2);
    curl_close($ch2);

    $dirasakanJson = json_decode($rawDirasakan, true);
    $listDirasakan = $dirasakanJson['Infogempa']['gempa'] ?? [];

    echo json_encode([
        'status' => 'success',
        'autogempa' => $autoGempa,
        'gempadirasakan' => $listDirasakan
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
