// Minimal ZIP writer (STORE / uncompressed method) with zero external
// dependencies -- used only for the "Download All" button on paid galleries.
// Uncompressed on purpose: photos are already JPEGs (they don't compress
// further), and STORE keeps this file simple enough to trust without a
// live test rig.

const CRC_TABLE = (() => {
    const table = [];
    for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) {
                  c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          }
          table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
          crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
    const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F);
    const dt = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
    return { time, dt };
}

// files: [{ name: 'photo.jpg', data: Buffer }]
function buildZip(files) {
    const { time, dt } = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

  for (const f of files) {
        const nameBuf = Buffer.from(f.name, 'utf8');
        const data = f.data;
        const crc = crc32(data);
        const size = data.length;

      const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(time, 10);
        localHeader.writeUInt16LE(dt, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(size, 18);
        localHeader.writeUInt32LE(size, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, nameBuf, data);

      const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(time, 12);
        centralHeader.writeUInt16LE(dt, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(size, 20);
        centralHeader.writeUInt32LE(size, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);

      centralParts.push(centralHeader, nameBuf);

      offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralStart = offset;
    const centralBuf = Buffer.concat(centralParts);

  const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(centralStart, 16);
    end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, end]);
}

module.exports = { buildZip, crc32 };
