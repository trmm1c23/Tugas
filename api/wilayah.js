// Vercel Serverless Function: api/wilayah.js
const ACEH_WILAYAH_TREE = [
  {
    id: 1,
    nama: 'Kota Lhokseumawe',
    kecamatan: [
      {
        id: 1,
        nama: 'Banda Sakti',
        kelurahan: [
          { id: 1, nama: 'Kampung Jawa Baru', kode_adm4: '11.73.02.2017' },
          { id: 2, nama: 'Simpang Empat', kode_adm4: '11.73.02.2007' },
          { id: 3, nama: 'Pusong Baru', kode_adm4: '11.73.02.2001' },
          { id: 4, nama: 'Hagu Teungoh', kode_adm4: '11.73.02.2013' },
          { id: 5, nama: 'Mon Geudong', kode_adm4: '11.73.02.2008' }
        ]
      },
      {
        id: 2,
        nama: 'Muara Dua',
        kelurahan: [
          { id: 6, nama: 'Uteunkot', kode_adm4: '11.73.01.2003' }
        ]
      },
      {
        id: 10,
        nama: 'Blang Mangat',
        kelurahan: [
          { id: 14, nama: 'Alue Lim', kode_adm4: '11.73.03.2002' }
        ]
      },
      {
        id: 11,
        nama: 'Muara Satu',
        kelurahan: [
          { id: 15, nama: 'Batuphat Timur', kode_adm4: '11.73.04.2001' }
        ]
      }
    ]
  },
  {
    id: 2,
    nama: 'Kota Banda Aceh',
    kecamatan: [
      {
        id: 3,
        nama: 'Baiturrahman',
        kelurahan: [
          { id: 7, nama: 'Kampung Baru', kode_adm4: '11.71.01.2001' }
        ]
      },
      {
        id: 4,
        nama: 'Kuta Alam',
        kelurahan: [
          { id: 8, nama: 'Peunayong', kode_adm4: '11.71.02.2004' }
        ]
      }
    ]
  },
  {
    id: 7,
    nama: 'Kabupaten Aceh Utara',
    kecamatan: [
      {
        id: 12,
        nama: 'Lhoksukon',
        kelurahan: [
          { id: 16, nama: 'Kuta Lhoksukon', kode_adm4: '11.08.04.2001' }
        ]
      },
      {
        id: 13,
        nama: 'Dewantara',
        kelurahan: [
          { id: 17, nama: 'Keude Krueng Geukueh', kode_adm4: '11.08.13.2001' }
        ]
      },
      {
        id: 14,
        nama: 'Syamtalira Bayu',
        kelurahan: [
          { id: 18, nama: 'Bayu', kode_adm4: '11.08.11.2001' }
        ]
      }
    ]
  },
  {
    id: 8,
    nama: 'Kabupaten Aceh Besar',
    kecamatan: [
      {
        id: 15,
        nama: 'Ingin Jaya',
        kelurahan: [
          { id: 19, nama: 'Lambaro', kode_adm4: '11.06.11.2001' }
        ]
      },
      {
        id: 16,
        nama: 'Darul Imarah',
        kelurahan: [
          { id: 20, nama: 'Lampeuneurut Gampong', kode_adm4: '11.06.07.2001' }
        ]
      }
    ]
  },
  {
    id: 9,
    nama: 'Kabupaten Bireuen',
    kecamatan: [
      {
        id: 17,
        nama: 'Kota Juang',
        kelurahan: [
          { id: 21, nama: 'Bireuen Meunasah Capa', kode_adm4: '11.11.13.2001' }
        ]
      }
    ]
  },
  {
    id: 10,
    nama: 'Kabupaten Aceh Tengah',
    kecamatan: [
      {
        id: 18,
        nama: 'Lut Tawar',
        kelurahan: [
          { id: 22, nama: 'Takengon Barat', kode_adm4: '11.04.03.2001' }
        ]
      }
    ]
  },
  {
    id: 11,
    nama: 'Kabupaten Aceh Barat',
    kecamatan: [
      {
        id: 19,
        nama: 'Johan Pahlawan',
        kelurahan: [
          { id: 23, nama: 'Ujong Baroh', kode_adm4: '11.05.01.2001' }
        ]
      }
    ]
  },
  {
    id: 12,
    nama: 'Kabupaten Pidie',
    kecamatan: [
      {
        id: 20,
        nama: 'Kota Sigli',
        kelurahan: [
          { id: 24, nama: 'Kramat Luar', kode_adm4: '11.07.03.2001' }
        ]
      }
    ]
  }
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type = 'tree', kabupaten_id, kecamatan_id } = req.query || {};

  // Check if MySQL is configured via env
  if (process.env.DB_HOST && process.env.DB_USER) {
    try {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'db_sistem_terintegrasi',
        port: Number(process.env.DB_PORT || 3306)
      });

      if (type === 'tree') {
        const [rows] = await conn.query(`
          SELECT 
            k.id AS kabupaten_id, k.nama_kabupaten,
            c.id AS kecamatan_id, c.nama_kecamatan,
            l.id AS kelurahan_id, l.nama_kelurahan, l.kode_adm4
          FROM kabupaten_kota k
          LEFT JOIN kecamatan c ON c.kabupaten_id = k.id
          LEFT JOIN kelurahan_desa l ON l.kecamatan_id = c.id
          ORDER BY k.nama_kabupaten ASC, c.nama_kecamatan ASC, l.nama_kelurahan ASC
        `);
        await conn.end();

        const treeObj = {};
        for (const r of rows) {
          if (!treeObj[r.kabupaten_id]) {
            treeObj[r.kabupaten_id] = { id: r.kabupaten_id, nama: r.nama_kabupaten, kecamatan: {} };
          }
          if (r.kecamatan_id) {
            if (!treeObj[r.kabupaten_id].kecamatan[r.kecamatan_id]) {
              treeObj[r.kabupaten_id].kecamatan[r.kecamatan_id] = { id: r.kecamatan_id, nama: r.nama_kecamatan, kelurahan: [] };
            }
            if (r.kelurahan_id) {
              treeObj[r.kabupaten_id].kecamatan[r.kecamatan_id].kelurahan.push({
                id: r.kelurahan_id,
                nama: r.nama_kelurahan,
                kode_adm4: r.kode_adm4
              });
            }
          }
        }
        const output = Object.values(treeObj).map(k => ({
          ...k,
          kecamatan: Object.values(k.kecamatan)
        }));
        return res.status(200).json({ status: 'success', data: output });
      }
      await conn.end();
    } catch (e) {
      // Fallback to static master data
      console.warn('DB connection skipped, using static Aceh master tree:', e.message);
    }
  }

  // Built-in Static Master Data Fallback
  if (type === 'tree') {
    return res.status(200).json({ status: 'success', data: ACEH_WILAYAH_TREE });
  }

  if (type === 'kabupaten') {
    const list = ACEH_WILAYAH_TREE.map(k => ({ id: k.id, nama_kabupaten: k.nama }));
    return res.status(200).json({ status: 'success', data: list });
  }

  if (type === 'kecamatan') {
    const kab = ACEH_WILAYAH_TREE.find(k => k.id == Number(kabupaten_id));
    const list = kab ? kab.kecamatan.map(c => ({ id: c.id, nama_kecamatan: c.nama })) : [];
    return res.status(200).json({ status: 'success', data: list });
  }

  if (type === 'kelurahan') {
    let list = [];
    for (const kab of ACEH_WILAYAH_TREE) {
      const kec = kab.kecamatan.find(c => c.id == Number(kecamatan_id));
      if (kec) {
        list = kec.kelurahan.map(l => ({ id: l.id, nama_kelurahan: l.nama, kode_adm4: l.kode_adm4 }));
        break;
      }
    }
    return res.status(200).json({ status: 'success', data: list });
  }

  return res.status(200).json({ status: 'success', data: ACEH_WILAYAH_TREE });
};

module.exports.ACEH_WILAYAH_TREE = ACEH_WILAYAH_TREE;
