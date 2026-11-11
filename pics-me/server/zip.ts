import { once } from "node:events";
import type { Writable } from "node:stream";
import zlib from "node:zlib";

/**
 * Minimal streaming ZIP writer (stored, no compression — the contents are
 * already-compressed pictures). Enough for account exports under 4 GB.
 */
export class ZipWriter {
  private out: Writable;
  private offset = 0;
  private entries: { name: Buffer; crc: number; size: number; offset: number }[] = [];
  private stamp: { time: number; date: number };

  constructor(out: Writable) {
    this.out = out;
    const d = new Date();
    this.stamp = {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  private async write(buf: Buffer) {
    this.offset += buf.length;
    if (!this.out.write(buf)) await once(this.out, "drain");
  }

  async add(path: string, data: Buffer) {
    const name = Buffer.from(path, "utf8");
    const crc = zlib.crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(0, 8); // stored
    head.writeUInt16LE(this.stamp.time, 10);
    head.writeUInt16LE(this.stamp.date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    this.entries.push({ name, crc, size: data.length, offset: this.offset });
    await this.write(Buffer.concat([head, name]));
    await this.write(data);
  }

  async end() {
    const start = this.offset;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(20, 4);
      c.writeUInt16LE(20, 6);
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(0, 10);
      c.writeUInt16LE(this.stamp.time, 12);
      c.writeUInt16LE(this.stamp.date, 14);
      c.writeUInt32LE(e.crc, 16);
      c.writeUInt32LE(e.size, 20);
      c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.name.length, 28);
      c.writeUInt32LE(e.offset, 42);
      await this.write(Buffer.concat([c, e.name]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - start, 12);
    end.writeUInt32LE(start, 16);
    await this.write(end);
    this.out.end();
  }
}
