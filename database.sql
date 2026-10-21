-- =====================================================================
-- Database: db_sistem_terintegrasi
-- Portal Resmi Prakiraan Cuaca, Kualitas Udara & Gempabumi BMKG Aceh
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `db_sistem_terintegrasi` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

USE `db_sistem_terintegrasi`;

-- --------------------------------------------------------
-- 1. Tabel: kabupaten_kota
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kabupaten_kota` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_kabupaten` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- 2. Tabel: kecamatan
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kecamatan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kabupaten_id` int NOT NULL,
  `nama_kecamatan` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `kabupaten_id` (`kabupaten_id`),
  CONSTRAINT `kecamatan_ibfk_1` FOREIGN KEY (`kabupaten_id`) REFERENCES `kabupaten_kota` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- 3. Tabel: kelurahan_desa
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kelurahan_desa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kecamatan_id` int NOT NULL,
  `nama_kelurahan` varchar(100) NOT NULL,
  `kode_adm4` varchar(20) DEFAULT NULL COMMENT 'Kode ADM4 BMKG/Kemendagri Provinsi Aceh',
  PRIMARY KEY (`id`),
  KEY `kecamatan_id` (`kecamatan_id`),
  CONSTRAINT `kelurahan_desa_ibfk_1` FOREIGN KEY (`kecamatan_id`) REFERENCES `kecamatan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- 4. Tabel: data_cuaca
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `data_cuaca` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kelurahan_id` int NOT NULL,
  `kondisi_cuaca` varchar(100) DEFAULT NULL,
  `suhu` decimal(4,1) DEFAULT NULL,
  `kelembapan` int DEFAULT NULL,
  `kecepatan_angin` varchar(20) DEFAULT NULL,
  `arah_angin` varchar(20) DEFAULT NULL,
  `icon_cuaca` varchar(255) DEFAULT NULL,
  `tanggal_update` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `kelurahan_id` (`kelurahan_id`),
  CONSTRAINT `data_cuaca_ibfk_1` FOREIGN KEY (`kelurahan_id`) REFERENCES `kelurahan_desa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Data Master Wilayah Provinsi Aceh: kabupaten_kota
-- --------------------------------------------------------
INSERT INTO `kabupaten_kota` (`id`, `nama_kabupaten`) VALUES
(1, 'Kota Lhokseumawe'),
(2, 'Kota Banda Aceh'),
(7, 'Kabupaten Aceh Utara'),
(8, 'Kabupaten Aceh Besar'),
(9, 'Kabupaten Bireuen'),
(10, 'Kabupaten Aceh Tengah'),
(11, 'Kabupaten Aceh Barat'),
(12, 'Kabupaten Pidie')
ON DUPLICATE KEY UPDATE `nama_kabupaten` = VALUES(`nama_kabupaten`);

-- --------------------------------------------------------
-- Data Master Wilayah Provinsi Aceh: kecamatan
-- --------------------------------------------------------
INSERT INTO `kecamatan` (`id`, `kabupaten_id`, `nama_kecamatan`) VALUES
(1, 1, 'Banda Sakti'),
(2, 1, 'Muara Dua'),
(3, 2, 'Baiturrahman'),
(4, 2, 'Kuta Alam'),
(10, 1, 'Blang Mangat'),
(11, 1, 'Muara Satu'),
(12, 7, 'Lhoksukon'),
(13, 7, 'Dewantara'),
(14, 7, 'Syamtalira Bayu'),
(15, 8, 'Ingin Jaya'),
(16, 8, 'Darul Imarah'),
(17, 9, 'Kota Juang'),
(18, 10, 'Lut Tawar'),
(19, 11, 'Johan Pahlawan')
ON DUPLICATE KEY UPDATE `nama_kecamatan` = VALUES(`nama_kecamatan`);

-- --------------------------------------------------------
-- Data Master Wilayah Provinsi Aceh: kelurahan_desa (ADM4)
-- --------------------------------------------------------
INSERT INTO `kelurahan_desa` (`id`, `kecamatan_id`, `nama_kelurahan`, `kode_adm4`) VALUES
(1, 1, 'Kampung Jawa Baru', '11.73.02.2017'),
(2, 1, 'Simpang Empat', '11.73.02.2007'),
(3, 1, 'Pusong Baru', '11.73.02.2001'),
(4, 1, 'Hagu Teungoh', '11.73.02.2013'),
(5, 1, 'Mon Geudong', '11.73.02.2008'),
(6, 2, 'Uteunkot', '11.73.01.2003'),
(7, 3, 'Kampung Baru', '11.71.01.2001'),
(8, 4, 'Peunayong', '11.71.02.2004'),
(14, 10, 'Alue Lim', '11.73.03.2002'),
(15, 11, 'Batuphat Timur', '11.73.04.2001'),
(16, 12, 'Kuta Lhoksukon', '11.08.04.2001'),
(17, 13, 'Keude Krueng Geukueh', '11.08.13.2001'),
(18, 14, 'Bayu', '11.08.11.2001'),
(19, 15, 'Lambaro', '11.06.11.2001'),
(20, 16, 'Lampeuneurut Gampong', '11.06.07.2001'),
(21, 17, 'Bireuen Meunasah Capa', '11.11.13.2001'),
(22, 18, 'Takengon Barat', '11.04.03.2001'),
(23, 19, 'Ujong Baroh', '11.05.01.2001')
ON DUPLICATE KEY UPDATE `kode_adm4` = VALUES(`kode_adm4`);
