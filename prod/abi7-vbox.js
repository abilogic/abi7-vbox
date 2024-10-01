/**
 * @ Author: Alexander Momot
 * @ Create Time: 2023-03-27 08:06:24
 * @ Modified by: Your name
 * @ Modified time: 2024-10-01 09:35:34
 * @ Description:
 * 
 * abi7Vbox is a class that enables various operations on MP4 and MOV
 * video files and provides detailed information. It can retrieve the
 * following information:
 * 
 * - Duration of video and audio tracks in seconds.
 * - Duration of video and audio tracks in samples.
 * - Frame rate.
 * - Audio bit depth and sample rate.
 * - Number of blocks.
 * - List of atoms.
 * - List of atoms with detailed information in a tree structure.
 * - List of data errors.
 * 
 * Additionally, the class allows the following manipulations:
 * - Analyzing errors with an attempt to correct them.
 * - Trimming video files with frame-level precision.
 */

'use strict';

/**
 * constants
 */

const ABI7_VBOX_STATUS_NONE = 0;
const ABI7_VBOX_STATUS_PARSED = 1;

const ABI7_VBOX_CHUNK_SIZE = 256 * 1024;
const ABI7_VBOX_ATOM_BUFFER_SIZE = 1024;

const ABI7_VBOX_ATOMS_FREE = ['free', 'skip', 'wide'];
const ABI7_VBOX_ATOMS_LVL0 = ['ftyp', 'mdat', 'meta', 'moov', 'uuid', 'free', 'skip', 'wide'];
const ABI7_VBOX_NO_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7];

const ABI7_VBOX_ATOMS = {
	'apch': { levels: [6], sub: [] },
	'apcs': { levels: [6], sub: [] },
	'avc1': { levels: [6], sub: ['avcC', 'colr'] },
	'avcC': { levels: [7], sub: [] },
	'blnk': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'bxml': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'chpl': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'clef': { levels: [3], sub: [] },
	'clip': { levels: [1], sub: [] },
	'cmov': { levels: [1], sub: ['cmvd'] },
	'cmvd': { levels: [2], sub: [] },
	'co64': { levels: [5], sub: [] },
	'colr': { levels: [7], sub: [] },
	'cslg': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'ctab': { levels: [1], sub: [] },
	'ctts': { levels: [5], sub: [] },
	'dcom': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'dinf': { levels: [4], sub: ['dref'] },
	'dlay': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'dref': { levels: [5], sub: [] },
	'drpo': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'drpt': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'edts': { levels: [2], sub: ['elst'] },
	'elst': { levels: [3], sub: [] },
	'emsg': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'esds': { levels: [7], sub: [] },
	'enof': { levels: [3], sub: [] },
	'fiin': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'free': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'ftyp': { levels: [0], sub: [] },
	'gmhd': { levels: [4], sub: ['tmcd'] },
	'hclr': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'hdlr': { levels: [1, 2, 3, 4], sub: [] },
	'hlit': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'hmhd': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'href': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'hvc1': { levels: [6], sub: ['hvcC', 'pasp'] },
	'hvcC': { levels: [7], sub: [] },
	'ilst': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'iods': { levels: [1], sub: [] },
	'krok': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'mdat': { levels: [0], sub: [] },
	'mdhd': { levels: [3], sub: [] },
	'mdia': { levels: [2], sub: ['mdhd', 'hdlr', 'minf'] },
	'mehd': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'meta': { levels: ABI7_VBOX_NO_LEVELS, sub: ['hdlr'] },
	'mfhd': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'mfra': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'mfro': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'minf': { levels: [3], sub: ['vmhd', 'dinf', 'stbl', 'smhd', 'hdlr', 'gmhd'] },
	'moof': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'moov': { levels: [0], sub: ['udta', 'mvhd', 'trak', 'iods', 'meta', 'clip', 'cmov','rmra'] },
	'mp4a': { levels: [6], sub: ['esds'] },
	'mp4v': { levels: [6], sub: ['esds'] },
	'mvex': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'mvhd': { levels: [1], sub: [] },
	'nmhd': { levels: [4], sub: [] },
	'padb': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'paen': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'pasp': { levels: [7], sub: [] },
	'pdin': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'pitm': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'prof': { levels: [3], sub: [] },
	'rmda': { levels: [2], sub: [] },
	'rmra': { levels: [1], sub: ['rmda'] },
	'sbgp': { levels: [5], sub: [] },
	'sdtp': { levels: [5], sub: [] },
	'segr': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'sgpd': { levels: [5], sub: [] },
	'skip': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'smhd': { levels: [4], sub: [] },
	'sowt': { levels: [6], sub: [] },
	'stbl': { levels: [4], sub: ['stsd', 'stts', 'stss', 'ctts', 'stsc', 'stsz', 'co64', 'sdtp', 'stco'] },
	'stco': { levels: [5], sub: [] },
	'stdp': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'stps': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'stsc': { levels: [5], sub: [] },
	'stsd': { levels: [5], sub: ['avc1', 'mp4a', 'tmcd'] },
	'stsh': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'stss': { levels: [5], sub: [] },
	'stsz': { levels: [5], sub: [] },
	'stts': { levels: [5], sub: [] },
	'stz2': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'styl': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'subs': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'tapt': { levels: [2], sub: ['clef', 'prof', 'enof'] },
	'tbox': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'tfhd': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'tfra': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'tkhd': { levels: [2], sub: [] },
	'tmcd': { levels: [3, 4, 5, 6], sub: [] },
	'traf': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'trak': { levels: [1], sub: ['tkhd', 'edts', 'mdia', 'tref'] },
	'tref': { levels: [2], sub: ['tmcd'] },
	'trex': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'trun': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'twos': { levels: [6], sub: [] },
	'twrp': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'udta': { levels: [1], sub: ['meta'] },
	'vmhd': { levels: [4], sub: [] },
	'uuid': { levels: ABI7_VBOX_NO_LEVELS, sub: [] },
	'wide': { levels: ABI7_VBOX_NO_LEVELS, sub: [] }
}

const ABI7_VBOX_ATOM_NAMES = Object.keys(ABI7_VBOX_ATOMS);

const ABI7_VBOX_TPL_HEADER_NAMES = [
	'apch',
	'apcs',
	'avc1',
	'avcC',
	'co64',
	'ctts',
	'dinf',
	'dref',
	'edts',
	'elst',
	'esds',
	'hdlr',
	'hvc1',
	'mdhd',
	'mdia',
	'minf',
	'moov',
	'mp4a',
	'mp4v',
	'mvhd',
	'nmhd',
	'sdtp',
	'smhd',
	'sowt',
	'stbl',
	'stco',
	'stsc',
	'stsd',
	'stss',
	'stsz',
	'stts',
	'tkhd',
	'tmcd',
	'trak',
	'tref',
	'twos',
	'vmhd'
];

const
	ATM_ELST_1 = 1131,
	ATM_ELST_2 = 1131,
	ATM_EDTS_1 = 1131,
	ATM_EDTS_2 = 1131,
	ATM_DINF_1 = 1131,
	ATM_DREF_1 = 1132,
	ATM_DINF_2 = 1131,
	ATM_DREF_2 = 1132,

	ATM_NONE_0 = -1,
	ATM_FTYP_0 = 0,
	ATM_UUID_0 = 1,
	ATM_MOOV_0 = 2,
	ATM_MVHD_0 = 3,
	ATM_TRAK_1 = 4,
	ATM_TKHD_1 = 5,
	ATM_MDIA_1 = 6,
	ATM_MDHD_1 = 7,
	ATM_HDLR_1 = 8,
	ATM_MINF_1 = 9,
	ATM_VMHD_1 = 10,
	ATM_STBL_1 = 11,
	ATM_STSD_1 = 12,
	ATM_CODV_1 = 13,
	ATM_CTTS_1 = 14,
	ATM_STTS_1 = 15,
	ATM_STSC_1 = 16,
	ATM_STSZ_1 = 17,
	ATM_STCO_1 = 18,
	ATM_STSS_1 = 19,
	ATM_TRAK_2 = 20,
	ATM_TKHD_2 = 21,
	ATM_MDIA_2 = 22,
	ATM_MDHD_2 = 23,
	ATM_HDLR_2 = 24,
	ATM_MINF_2 = 25,
	ATM_SMHD_2 = 26,
	ATM_STBL_2 = 27,
	ATM_STSD_2 = 28,
	ATM_CODA_2 = 29,
	ATM_STTS_2 = 30,
	ATM_STSC_2 = 31,
	ATM_STSZ_2 = 32,
	ATM_STCO_2 = 33,
	ATM_FREE_0 = 34,
	ATM_MDAT_0 = 35;


const ABI7_VBOX_TPL_FILE = {
	[ATM_FTYP_0]: { name: 'ftyp', lvl: 0, par: ATM_NONE_0, copy: 1 },
	[ATM_UUID_0]: { name: 'uuid', lvl: 0, par: ATM_NONE_0, copy: 1 },
	[ATM_MOOV_0]: { name: 'moov', lvl: 0, par: ATM_NONE_0, copy: 0 },
	[ATM_MVHD_0]: { name: 'mvhd', lvl: 1, par: ATM_MOOV_0, copy: 1 },

	[ATM_TRAK_1]: { name: 'trak', lvl: 1, par: ATM_MOOV_0, copy: 0 },
	[ATM_TKHD_1]: { name: 'tkhd', lvl: 2, par: ATM_TRAK_1, copy: 1 },
	//[ATM_EDTS_1]: { name: 'edts', lvl: 2, par: ATM_TRAK_1, copy: 1 },
	[ATM_MDIA_1]: { name: 'mdia', lvl: 2, par: ATM_TRAK_1, copy: 0 },
	[ATM_MDHD_1]: { name: 'mdhd', lvl: 3, par: ATM_MDIA_1, copy: 1 },
	[ATM_HDLR_1]: { name: 'hdlr', lvl: 3, par: ATM_MDIA_1, copy: 1 },
	[ATM_MINF_1]: { name: 'minf', lvl: 3, par: ATM_MDIA_1, copy: 0 },
	[ATM_VMHD_1]: { name: 'vmhd', lvl: 4, par: ATM_MINF_1, copy: 1 },
	//[ATM_DINF_1]: { name: 'dinf', lvl: 4, par: ATM_MINF_1, copy: 0 },
	//[ATM_DREF_1]: { name: 'dref', lvl: 5, par: ATM_DINF_1, copy: 1 },
	[ATM_STBL_1]: { name: 'stbl', lvl: 4, par: ATM_MINF_1, copy: 0 },
	[ATM_STSD_1]: { name: 'stsd', lvl: 5, par: ATM_STBL_1, copy: 1 },
	[ATM_CODV_1]: { name: 'codv', lvl: 6, par: ATM_STSD_1, copy: 1 },
	[ATM_CTTS_1]: { name: 'ctts', lvl: 5, par: ATM_STBL_1, copy: 1 },
	[ATM_STTS_1]: { name: 'stts', lvl: 5, par: ATM_STBL_1, copy: 1 },
	[ATM_STSC_1]: { name: 'stsc', lvl: 5, par: ATM_STBL_1, copy: 1 },
	[ATM_STSZ_1]: { name: 'stsz', lvl: 5, par: ATM_STBL_1, copy: 1 },
	[ATM_STCO_1]: { name: 'stco', lvl: 5, par: ATM_STBL_1, copy: 1 },
	[ATM_STSS_1]: { name: 'stss', lvl: 5, par: ATM_STBL_1, copy: 1 },

	[ATM_TRAK_2]: { name: 'trak', lvl: 1, par: ATM_MOOV_0, copy: 0 },
	[ATM_TKHD_2]: { name: 'tkhd', lvl: 2, par: ATM_TRAK_2, copy: 1 },
	//[ATM_EDTS_2]: { name: 'edts', lvl: 2, par: ATM_TRAK_2, copy: 1 },
	[ATM_MDIA_2]: { name: 'mdia', lvl: 2, par: ATM_TRAK_2, copy: 0 },
	[ATM_MDHD_2]: { name: 'mdhd', lvl: 3, par: ATM_MDIA_2, copy: 1 },
	[ATM_HDLR_2]: { name: 'hdlr', lvl: 3, par: ATM_MDIA_2, copy: 1 },
	[ATM_MINF_2]: { name: 'minf', lvl: 3, par: ATM_MDIA_2, copy: 0 },
	[ATM_SMHD_2]: { name: 'smhd', lvl: 4, par: ATM_MINF_2, copy: 1 },
	//[ATM_DINF_2]: { name: 'dinf', lvl: 4, par: ATM_MINF_2, copy: 0 },
	//[ATM_DREF_2]: { name: 'dref', lvl: 5, par: ATM_DINF_2, copy: 1 },
	[ATM_STBL_2]: { name: 'stbl', lvl: 4, par: ATM_MINF_2, copy: 0 },
	[ATM_STSD_2]: { name: 'stsd', lvl: 5, par: ATM_STBL_2, copy: 1 },
	[ATM_CODA_2]: { name: 'coda', lvl: 6, par: ATM_STSD_2, copy: 1 },
	[ATM_STTS_2]: { name: 'stts', lvl: 5, par: ATM_STBL_2, copy: 1 },
	[ATM_STSC_2]: { name: 'stsc', lvl: 5, par: ATM_STBL_2, copy: 1 },
	[ATM_STSZ_2]: { name: 'stsz', lvl: 5, par: ATM_STBL_2, copy: 1 },
	[ATM_STCO_2]: { name: 'stco', lvl: 5, par: ATM_STBL_2, copy: 1 },

	[ATM_FREE_0]: { name: 'free', lvl: 0, par: ATM_NONE_0, copy: 1 },
	[ATM_MDAT_0]: { name: 'mdat', lvl: 0, par: ATM_NONE_0, copy: 1 }
}

const ABI7_VBOX_TPL_MATRIX = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0]);
const ABI7_VBOX_TPL_TIME = Math.round((new Date().getTime() + (new Date(Date.UTC(1970, 1, 1)).getTime() - new Date(1904, 1, 1).getTime())) / 1000);

const ABI7_VBOX_TPL_ACODEC = ['mp4a', 'twos', 'sowt'];
const ABI7_VBOX_TPL_ACODEC_SUB = ['esds'];
const ABI7_VBOX_TPL_VCODEC = ['avc1', 'hvc1', 'apch', 'apcs', 'mp4v'];
const ABI7_VBOX_TPL_VCODEC_SUB = ['avcC', 'hvcC', 'pasp', 'colr', 'esds'];
const ABI7_VBOX_TPL_TCODEC = ['tmcd'];



/**
 * Number prototypes
 */

Number.prototype.isRound = function (div) {
	return (Math.floor(this / div) * div == this);
}


Number.prototype.inRange = function (val, shift) {
	let	div = this / val;
	return (div < 1 + shift && div > 1 - shift);
}

/**
 * Array prototypes
 */

Array.prototype.indexOfArray = function (obj, offset) {
	offset = offset || 0;
	for (let i = offset; i < 1 + (this.length - obj.length); i++) {
		let j = 0;
		for (; j < obj.length; j++) {
			if (this[i + j] !== obj[j]) break;
		}
		if (j == obj.length) return i;
	}
	return -1;
}

Array.prototype.equals = function (arr) {
	return (arr.length === this.length && this.every(function (v, i) { return v === arr[i] }));
}

Array.prototype.median = function () {
	let	mid = Math.floor(this.length / 2);
	let	nums = [...this].sort((a, b) => a - b);
	return this.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * Unit8Array prototypes
 */

Uint8Array.prototype.concat = function (arr) {
	let res = new Uint8Array(this.length + arr.length);
	res.set(this);
	res.set(arr, this.length);
	return res;
}

Uint8Array.prototype.setString = function (value, pos) {
	pos = pos || 0;
	for (let i = 0; i < value.length; i++) {
		this[i + pos] = value.charCodeAt(i);
	}
}

Uint8Array.prototype.setName = function (value, pos) {
	pos = pos || 4;
	if (value.length == 4) {
		this.setString(value, pos);
	}
}

Uint8Array.prototype.setInt64 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setBigInt64(pos, BigInt(value), false);
}

Uint8Array.prototype.setUint64 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setBigUint64(pos, BigInt(value), false);
}

Uint8Array.prototype.setInt32 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setInt32(pos, value, false);
}

Uint8Array.prototype.setUint32 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setUint32(pos, value, false);
}

Uint8Array.prototype.setInt16 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setInt16(pos, value, false);
}

Uint8Array.prototype.setUint16 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setUint16(pos, value, false);
}

Uint8Array.prototype.setInt8 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setInt8(pos, value, false);
}

Uint8Array.prototype.setUint8 = function (value, pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	view.setUint8(pos, value, false);
}

Uint8Array.prototype.setSize = function (value, pos) {
	pos = pos || 0;
	this.setUint32(value, pos);
}

Uint8Array.prototype.setArray = function (value, pos) {
	pos = pos || 0;
	this.set(value, pos);
}

Uint8Array.prototype.getUint8 = function (pos) {
	pos = pos || 0;
	let view = new DataView(this.buffer);
	return view.getUint8(pos, false);
}

Uint8Array.prototype.getInt8 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return view.getInt8(pos, le);
}

Uint8Array.prototype.getUint16 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return view.getUint16(pos, le);
}

Uint8Array.prototype.getInt16 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return view.getInt16(pos, le);
}

Uint8Array.prototype.getUint32 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return view.getUint32(pos, le);
}

Uint8Array.prototype.getInt32 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return view.getInt32(pos, le);
}

Uint8Array.prototype.getUint64 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return Number(view.getBigUint64(pos, le));
}

Uint8Array.prototype.getInt64 = function (pos, le) {
	pos = pos || 0;
	le = le || false;
	let view = new DataView(this.buffer);
	return Number(view.getBigInt64(pos, le));
}

Uint8Array.prototype.getUint32BE = function (pos) {
	return (this[pos] << 24) |
		(this[pos + 1] << 16) |
		(this[pos + 2] << 8) |
		(this[pos + 3]);
}

Uint8Array.prototype.getDate = function (pos) {
	let	sec = Math.abs((new Date(Date.UTC(1970, 1, 1)).getTime() - new Date(1904, 1, 1).getTime()) / 1000);
	return new Date((this.getUint32(pos) - sec) * 1000);
}

Uint8Array.prototype.getFloat32Fix = function (pos) {
	return abi_bytes2int(Array.from(this.subarray(pos, pos + 2)));
}

Uint8Array.prototype.getString = function (pos, len) {
	let	txt = new TextDecoder('ascii');
	return txt.decode(this.subarray(pos, pos + len));
}

Uint8Array.prototype.isString = function (pos, len) {
	let	arr = Array.from(this.subarray(pos, len));
	for (let i = 0; i < arr.len; i++) {
		if (!((arr[i] > 64 && arr[i] < 91) || (arr[i] > 96 && arr[i] < 123))) {
			return false;
		}
	}
	return true;
}

Uint8Array.prototype.getVersion = function (pos) {
	pos = pos || 0;
	return this.getUint8(0);
}

Uint8Array.prototype.getHex = function (pos) {
	pos = pos || 0;
	return Array.from(Array.from(this), function (byte) {
		return ('0' + (byte & 0xFF).toString(16)).slice(-2);
	}).join(' ');
}

Uint8Array.prototype.getBytesStr = function (pos) {
	pos = pos || 0;
	return Array.from(Array.from(this), function (byte) {
		return String(byte).padStart(3, '0');
	}).join(' ');
}

Uint8Array.prototype.indexOfPattern = function (pat, pos) {
	pos = pos || 0;
	let found = -1;

	for (let i = pos; i <= this.length - pat.length; i++) {
		found = i;
		for (let j = 0; j < pat.length; j++) {
			if (pat[j] > -1) {
				if (pat[j] != this[i + j]) {
					found = -1;
					break;
				}
			}
		}
		if (found > -1) return found;
	}
	return -1;
}

Uint8Array.prototype.getBinString = function () {
	return this.reduce(function (str, byte) { return str + byte.toString(2).padStart(8, '0') }, '');
}

/**
 * @ Author: Alexander Momot
 * @ Create Time: 2023-03-29 08:05:27
 * @ Modified by: Alexander Momot
 * @ Modified time: 2023-10-24 08:22:20
 * @ Description: Video File Parser
 */

class abi7VboxAtom {
	constructor() {
	}
}

//------------------------------------------------------------------------------

class abi7VboxFileReader {
	constructor(file) {
		this.file = file;
		this.onDone = null;
		this.onChunk = null;
		this.onFail = null;
		this.onParsing = null;
		this.init();
	}

	init() {
		const self = this;
		let offset = 0;
		let endPos = self.file.size;
		let percOne = (endPos - offset) / 100;
		let percVal = 0;

		let onLoadHandler = (event) => {
			let result = event.target.result;

			if (event.target.error == null) {
				if (self.onChunk) {
					self.onChunk(offset, result);
					if (self.onParsing) {
						let perc = Math.round(offset / percOne);
						if (perc > percVal) {
							percVal = perc;
							self.onParsing(perc);
						}
					}
				}
				offset += event.target.result.byteLength;
			} else {
				if (self.onFail) {
					self.onFail(event.target.error);
				}
				return;
			}

			if (offset >= endPos) {
				if (self.onDone) {
					self.onDone();
				}
				return;
			}

			readBlock(offset);
		}

		let readBlock = () => {
			let fileReader = new FileReader();
			let chunkSize = Math.min(ABI7_VBOX_CHUNK_SIZE, self.file.size - offset);
			let blob = self.file.slice(offset, offset + chunkSize);
			fileReader.onload = onLoadHandler;
			fileReader.readAsArrayBuffer(blob);
		}

		readBlock();
	}

	done(func) {
		this.onDone = func;
		return this;
	}

	fail(func) {
		this.onFail = func;
		return this;
	}

	chunk(func) {
		this.onChunk = func;
		return this;
	}

	parsing(func) {
		this.onParsing = func;
		return this;
	}
}

//------------------------------------------------------------------------------

class abi7VboxData {
	constructor(options) {
		const self = this;
		self.defaults = {
		}
		self.config = Object.assign({}, self.defaults, options);
		self.init();
	}

	init() {
		const self = this;
	}
}

//------------------------------------------------------------------------------

class abi7VboxParser {
	constructor(vbox, successCallback) {
		const self = this;
		self.vbox = vbox;
		self.config = vbox.config;
		self.file = vbox.file;
		self.prevData = new Uint8Array();
		self.DATA = {
			ATOMS: [],
			CHECKS: {},
			PARAMS: {
				CODA: {},
				CODV: {},
				DURATION: {},
				FRAMERATE: {},
				RATIO: {},
				SAMPLES: {},
				TIMESCALE: {},
				TRACKHEIGHT: {},
				TRACKWIDTH: {},
				TRACKLENGTH: {},
				TRACK_0: [],
				TRACK_1: [],
				TRACK_2: []
			},
			HEADER: {},
			INFO: {}
		}
		self.successCallback = (typeof successCallback === 'function') ? successCallback : () => { };
		self.onParsing = (self.vbox.events.onParsing || false);
		self.init();
	}

	//--------------------------------------------------------------------------

	init() {
		const self = this;

		if (typeof self.vbox.events.onParsingStart === 'function') {
			self.vbox.events.onParsingStart(self.vbox);
		}

		self.fileReader = new abi7VboxFileReader(self.file)
			.chunk((offset, data) => {
				self.parseChunk(offset, data);
			})
			.fail((error) => {
				self.vbox.error(self, error);
			})
			.done(() => {
				self.parseData(() => {
					self.vbox.setStatus(ABI7_VBOX_STATUS_PARSED);
					self.successCallback(self.vbox, self.DATA);
					if (typeof self.vbox.events.onParsingEnd === 'function') {
						self.vbox.events.onParsingEnd(self.vbox, self.DATA);
					}
				});
			})
			.parsing((perc) => {
				if (self.onParsing) {
					self.onParsing(self, perc);
				}
			});
	}

	//--------------------------------------------------------------------------

	parseChunk(offset, data) {
		const self = this;
		let atomMdat = self.findAtoms('mdat', 0);

		data = new Uint8Array(data);
		data = self.prevData.concat(data.subarray(0, data.length - 5));
		offset -= self.prevData.length;


		let text = new TextDecoder('ascii').decode(data);

		//--- find atoms in chunks

		ABI7_VBOX_ATOM_NAMES.forEach(name => {
			let fATM = 0;
			let fCUR = 0;
			let fPOS = 0;
			let fSIZE = 0;
			let fOFFS = 0;
			while (1) {
				fPOS = text.indexOf(name, fCUR);
				if (fPOS < 0) {
					break;
				}
				fSIZE = data.getUint32(fPOS - 4);
				fOFFS = (fSIZE == 1) ? 16 : 8;
				if (fSIZE == 1) {
					fSIZE = data.getUint64(fPOS + 4);
				}
				if (fSIZE < self.file.size) {
					let atoms = self.findAtoms(name);
					if (name === 'mdat') {
						self.DATA.PARAMS.MDAT = offset + fPOS - 4;
					}

					fATM = new abi7VboxAtom();
					fATM.name = name;
					fATM.pos = offset + fPOS - 4;
					fATM.next = fSIZE + fATM.pos;
					fATM.last = (fATM.next >= self.file.size);
					fATM.size = fSIZE;
					fATM.id = atoms.length;
					fATM.edit = 0;
					fATM.data = new Uint8Array(ABI7_VBOX_ATOM_BUFFER_SIZE);
					fATM.data.set(data.subarray(fPOS + 4).subarray(0, ABI7_VBOX_ATOM_BUFFER_SIZE));
					fATM.data_offs = fOFFS;
					fATM.inMDAT = (atomMdat.length && fATM.pos > atomMdat[0].pos && fATM.pos + 4 < atomMdat[0].pos + atomMdat[0].size);
					self.DATA.ATOMS.push(fATM);
				}
				fCUR = fPOS + 4;
			}
		});
	}

	//--------------------------------------------------------------------------

	readFile(pos, len, callback) {
		const self = this;
		let r = new FileReader();
		let b = self.file.slice(pos, Math.min(pos + len, self.file.size));

		r.onload = (e) => {
			if (e.target.error == null) {
				callback(new Uint8Array(e.target.result));
			}
		}
		r.readAsArrayBuffer(b);
	}

	//--------------------------------------------------------------------------

	findAtoms(name, id) {
		const self = this;
		let atm = 0;
		let res = [];

		if (!Array.isArray(name)) {
			name = [name];
		}

		for (let i = 0; i < self.DATA.ATOMS.length; i++) {
			atm = self.DATA.ATOMS[i];
			if (name.indexOf(atm.name) > -1) {
				if (id) {
					if (atm.id == id) {
						res.push(atm);
						break;
					}
				} else {
					res.push(atm);
				}
			}
		}
		return res;
	}

	//--------------------------------------------------------------------------

	findTrAtoms(name, id) {
		const self = this;
		let atm = 0;
		let arr = 0;
		let res = [];

		id = id || 0;
		if (self.DATA.PARAMS['TRACK_' + id]) {
			arr = self.DATA.PARAMS['TRACK_' + id];
		} else {
			return [];
		}

		if (!Array.isArray(name)) {
			name = [name];
		}

		for (let i = 0; i < arr.length; i++) {
			atm = arr[i];
			if (name.indexOf(atm.name) > -1) {
				res.push(atm);
			}
		}
		return res;
	}

	//--------------------------------------------------------------------------

	emptyAtomNames() {
		const self = this;
		let res = ABI7_VBOX_ATOMS_FREE.map(a => a);

		ABI7_VBOX_ATOM_NAMES.forEach(name => {
			if (!ABI7_VBOX_ATOMS[name].sub.length && res.indexOf(name) < 0) {
				res.push(name);
			}
		});

		return res;
	}

	//--------------------------------------------------------------------------

	parseHeaderTracks(callback) {
		const self = this;
		let pos = 0;
		let min = 0;
		let val = 0;
		let atoms = 0;
		let arr_ch = 0;
		let arr = 0;
		let res = 0;
		let atm = 0;
		let arr_chnks = [];
		let arr_stops = [];
		let arr_spots = [];

		//--- find stbl chains
		arr_ch = ['stsd', 'stts', 'stsc', 'stsz', 'stco', 'ctts', 'stss', 'sdtp', 'co64'].concat(ABI7_VBOX_TPL_ACODEC, ABI7_VBOX_TPL_ACODEC_SUB, ABI7_VBOX_TPL_VCODEC, ABI7_VBOX_TPL_VCODEC_SUB, ABI7_VBOX_TPL_TCODEC, ABI7_VBOX_ATOMS_FREE);
		while (pos < self.DATA.ATOMS.length) {
			atoms = [];
			while (pos < self.DATA.ATOMS.length && arr_ch.indexOf(self.DATA.ATOMS[pos].name) > -1) {
				if (ABI7_VBOX_ATOMS_FREE.indexOf(self.DATA.ATOMS[pos].name) < 0) {
					if (atoms.indexOf(self.DATA.ATOMS[pos]) > -1) {
						break;
					} else {
						atoms.push(self.DATA.ATOMS[pos]);
					}
				}
				pos++;
			}
			if (atoms.length) {
				arr_spots.push(atoms);
			} else {
				pos++;
			}
		}

		//--- remove chains contained < 2 elements

		arr_spots = arr_spots.filter(a => a.length > 1);

		//--- scan chains up to tkhd atom

		pos = 0;
		arr = ['hdlr', 'tkhd', 'mdhd', 'vmhd', 'smhd', 'nmhd', 'gmhd', 'edts', 'elst', 'dref', 'tref', 'tmcd'];
		arr_stops = ['stsd', 'stts', 'stsc', 'stsz', 'stco', 'ctts', 'stss', 'sdtp', 'co64', 'trak'].concat(ABI7_VBOX_TPL_ACODEC, ABI7_VBOX_TPL_ACODEC_SUB, ABI7_VBOX_TPL_VCODEC, ABI7_VBOX_TPL_VCODEC_SUB, ABI7_VBOX_ATOMS_LVL0);

		arr_spots.map(a => a).forEach((a, i) => {
			min = Math.min.apply(null, a.map(b => b.pos));
			pos = self.DATA.ATOMS.findIndex(f => f.pos === min) - 1;
			while (pos > 0) {
				atm = self.DATA.ATOMS[pos];
				if (arr_stops.indexOf(atm.name) > -1) {
					break;
				}
				if (arr.indexOf(atm.name) > -1) {
					arr_spots[i] = [atm].concat(arr_spots[i]);
				}
				pos--;
			}
		});

		//--- remove unused hdlr atoms

		arr_spots = arr_spots.map(a => {
			return a.filter(b => {
				return (b.name != 'hdlr') || (b.name == 'hdlr' && ['vide', 'soun', 'tmcd'].indexOf(b.data.getString(8, 4)) > -1)
			})
		});

		//--- detect type of trak #1

		arr_spots.forEach((a, i) => {
			arr = a.map(b => b.name);

			arr_stops = ['vmhd'].concat(ABI7_VBOX_TPL_VCODEC);
			if (arr_stops.some(c => arr.includes(c))) {
				arr_spots[i] = {
					track: 1,
					atoms: a
				}
				return;
			}

			arr_stops = ['smhd'].concat(ABI7_VBOX_TPL_ACODEC);
			if (arr_stops.some(c => arr.includes(c))) {
				arr_spots[i] = {
					track: 2,
					atoms: a
				}
				return;
			}

			arr_stops = ['nmhd', 'gmhd'];
			if (arr_stops.some(c => arr.includes(c))) {
				arr_spots[i] = {
					track: 3,
					atoms: a
				}
				return;
			}
		});


		//--- detect type of trak #2

		arr_spots.forEach((a, i) => {
			if (Array.isArray(a)) {
				pos = a.map(b => b.name).indexOf('tkhd');
				if (pos > -1) {
					val = a[pos].data.getUint32(12);
					if ([1, 2, 3].indexOf(val) > -1) {
						arr_spots[i] = {
							track: val,
							atoms: a
						}
					}
				} else {
					pos = a.map(b => b.name).indexOf('hdlr');
					if (pos > -1) {
						val = a.data.getString(8, 4);
						if (val == 'vide') {
							arr_spots[i] = {
								track: 1,
								atoms: a
							}
						} else {
							if (val == 'soun') {
								arr_spots[i] = {
									track: 2,
									atoms: a
								}
							} else {
								if (val == 'tmcd') {
									arr_spots[i] = {
										track: 3,
										atoms: a
									}
								}
							}
						}
					}
				}
			}
		});

		arr_spots.forEach(a => {
			if (typeof a === 'object' && !Array.isArray(a)) {
				a.atoms.forEach(function (atom) {
					pos = self.DATA.PARAMS['TRACK_' + (a.track - 1)].map(function (c) { return c.name }).indexOf(atom.name);
					if (pos > -1) {
						self.DATA.PARAMS['TRACK_' + (a.track - 1)][pos] = atom;
					} else {
						self.DATA.PARAMS['TRACK_' + (a.track - 1)].push(atom);
					}
				});
			}
		});

		res = (self.DATA.PARAMS.TRACK_0.length || self.DATA.PARAMS.TRACK_1.length);
		if (res) {
			atoms = self.findTrAtoms(['stco', 'co64'], 0);
			if (atoms.length) {
				arr_chnks = arr_chnks.concat(atoms[0].entries.map(a => { return { trak: 0, offs: a } }));
			}
			atoms = self.findTrAtoms(['stco', 'co64'], 1);
			if (atoms.length) {
				arr_chnks = arr_chnks.concat(atoms[0].entries.map(a => { return { trak: 1, offs: a } }));
			}
			arr_chnks.sort((a, b) => { return (a.offs > b.offs) ? 1 : (a.offs < b.offs) ? -1 : 0 });

			let mdat = self.findAtoms('mdat');
			let stsz = {
				0: self.findTrAtoms('stsz', 0),
				1: self.findTrAtoms('stsz', 1)
			}
			let stsc = {
				0: self.findTrAtoms('stsc', 0),
				1: self.findTrAtoms('stsc', 1)
			}
			let samples = {
				0: 1,
				1: 1
			}
			let idx = [];
			if (mdat.length) {
				arr_chnks.forEach((c, i, a) => {
					if (!idx[c.trak]) {
						idx[c.trak] = 0;
					}
					idx[c.trak]++;
					c.index = idx[c.trak];
					if (i < a.length - 1) {
						c.size = a[i + 1].offs - c.offs;
					} else {
						c.size = mdat[0].next - c.offs;
					}

					c.origin = {
						offset: c.offs,
						size: c.size
					}

					if (stsc[c.trak].length) {
						let sc = stsc[c.trak][0].entries.find(i => i.f_chunk <= c.index);
						c.samples = {
							start: samples[c.trak],
							count: sc.samples
						}
						samples[c.trak] += sc.samples;
						c.origin.samplesIndex = samples[c.trak];
						c.origin.samplesCount = sc.samples;
					}

					if (stsz[c.trak].length && c.samples) {
						c.samples.sizes = stsz[c.trak][0].entries.slice(c.samples.start - 1, c.samples.start + c.samples.count - 1);
					}

				});
			}

			self.DATA.CHUNKS = arr_chnks;
		} else {
			/*
			self.funcScan({
				owner: self,
				action: 'error',
				desc: 'Tracks not found'
			});
			*/
		}
		callback(res);
	}

	//--------------------------------------------------------------------------

	parseMediaData(callback) {
		const self = this;
		let val = 0;
		let ver = 0;
		let num = 0;
		let obj = 0;
		let arr = 0;
		let offs = 0;
		let atoms = 0;
		let a1 = 0;
		let a2 = 0;

		let mvhd = self.findAtoms('mvhd', 0);

		let stsz_0 = self.findTrAtoms('stsz', 0);
		let stsz_1 = self.findTrAtoms('stsz', 1);

		let stts_0 = self.findTrAtoms('stts', 0);
		let stts_1 = self.findTrAtoms('stts', 1);

		let mdhd_0 = self.findTrAtoms('mdhd', 0);
		let mdhd_1 = self.findTrAtoms('mdhd', 1);

		let tkhd_0 = self.findTrAtoms('tkhd', 0);
		let tkhd_1 = self.findTrAtoms('tkhd', 1);

		let elst_0 = self.findTrAtoms('elst', 0);
		let elst_1 = self.findTrAtoms('elst', 1);

		let codv = self.findTrAtoms(['avc1', 'hvc1'], 0);
		let coda = self.findTrAtoms(['mp4a'], 1);

		//--- MDHD -------------------------------------------------------------

		if (mdhd_0.length) {
			ver = mdhd_0[0].data.getVersion();
			val = mdhd_0[0].data.getUint32((ver == 1) ? 20 : 12);
			self.DATA.PARAMS.TIMESCALE.MDHD_0 = val;
			val = (ver == 1) ? mdhd_0[0].data.getUint64(24) : mdhd_0[0].data.getUint32(16);
			self.DATA.PARAMS.DURATION.MDHD_0 = val;
		}

		if (mdhd_1.length) {
			ver = mdhd_1[0].data.getVersion();
			val = mdhd_1[0].data.getUint32((ver == 1) ? 20 : 12);
			self.DATA.PARAMS.TIMESCALE.MDHD_1 = val;
			val = (ver == 1) ? mdhd_1[0].data.getUint64(24) : mdhd_1[0].data.getUint32(16);
			self.DATA.PARAMS.DURATION.MDHD_1 = val;
		}

		//--- MVHD -------------------------------------------------------------

		if (mvhd.length) {
			ver = mvhd[0].data.getVersion();
			val = (ver == 1) ? mvhd[0].data.getUint64(24) : mvhd[0].data.getUint32(16);
			self.DATA.PARAMS.DURATION.MVHD = val;
			val = mvhd[0].data.getUint32((ver == 1) ? 20 : 12);
			self.DATA.PARAMS.TIMESCALE.MVHD = val;
		}

		//--- TKHD -------------------------------------------------------------

		if (tkhd_0.length) {
			ver = tkhd_0[0].data.getVersion();
			val = (ver == 1) ? tkhd_0[0].data.getUint64(28) : tkhd_0[0].data.getUint32(20);
			self.DATA.PARAMS.DURATION.TKHD_0 = val;
			val = tkhd_0[0].data.getUint16((ver == 1) ? 88 : 76);
			self.DATA.PARAMS.TRACKWIDTH.TKHD_0 = val;
			val = tkhd_0[0].data.getUint16((ver == 1) ? 92 : 80);
			self.DATA.PARAMS.TRACKHEIGHT.TKHD_0 = val;
		}
		if (tkhd_1.length) {
			ver = tkhd_1[0].data.getVersion();
			val = (ver == 1) ? tkhd_1[0].data.getUint64(28) : tkhd_1[0].data.getUint32(20);
			self.DATA.PARAMS.DURATION.TKHD_1 = val;
			val = tkhd_1[0].data.getUint16((ver == 1) ? 88 : 76);
			self.DATA.PARAMS.TRACKWIDTH.TKHD_1 = val;
			val = tkhd_1[0].data.getUint16((ver == 1) ? 92 : 80);
			self.DATA.PARAMS.TRACKHEIGHT.TKHD_1 = val;
		}

		//--- ELST -------------------------------------------------------------

		if (elst_0.length) {
			ver = elst_0[0].data.getVersion();
			num = elst_0[0].data.getUint32(4);
			val = 0;
			for (let i = 0; i < num; i++) {
				val += (ver == 1) ? elst_0[0].data.getUint64(8 + i * 16) : elst_0[0].data.getUint32(8 + i * 8);
			}
			self.DATA.PARAMS.DURATION.ELST_0 = val;
		}
		if (elst_1.length) {
			ver = elst_1[0].data.getVersion();
			num = elst_1[0].data.getUint32(4);
			val = 0;
			for (let i = 0; i < num; i++) {
				val += (ver == 1) ? elst_1[0].data.getUint64(8 + i * 16) : elst_1[0].data.getUint32(8 + i * 8);
			}
			self.DATA.PARAMS.DURATION.ELST_1 = val;
		}

		//--- STSZ -------------------------------------------------------------

		if (stsz_0.length) {
			self.DATA.PARAMS.SAMPLES.STSZ_V_SIZE = stsz_0[0].data.getUint32(4);
			self.DATA.PARAMS.SAMPLES.STSZ_V_NUMBER = stsz_0[0].data.getUint32(8);
		}

		if (stsz_1.length) {
			self.DATA.PARAMS.SAMPLES.STSZ_A_SIZE = stsz_1[0].data.getUint32(4);
			self.DATA.PARAMS.SAMPLES.STSZ_A_NUMBER = stsz_1[0].data.getUint32(8);
		}

		//--- STTS -------------------------------------------------------------

		if (stts_0.length) {
			self.DATA.PARAMS.SAMPLES.STTS_V_NUMBER = stts_0[0].data.getUint32(8);
		}

		if (stts_1.length) {
			self.DATA.PARAMS.SAMPLES.STTS_A_NUMBER = stts_1[0].data.getUint32(8);
		}

		//--- CODV -------------------------------------------------------------

		if (codv.length) {
			//--- video format
			self.DATA.PARAMS.CODV.FORMAT = codv[0].name;
			if (codv[0].name == 'avc1') {
				self.DATA.PARAMS.TRACKWIDTH.CODV = codv[0].data.getUint16(24);
				self.DATA.PARAMS.TRACKHEIGHT.CODV = codv[0].data.getUint16(26);
			} else
				if (codv[0].name == 'hvc1') {
					self.DATA.PARAMS.TRACKWIDTH.CODV = codv[0].data.getUint16(32);
					self.DATA.PARAMS.TRACKHEIGHT.CODV = codv[0].data.getUint16(34);
				}
		}

		//--- CODA -------------------------------------------------------------

		if (coda.length) {
			//--- audio format
			self.DATA.PARAMS.CODA.FORMAT = coda[0].name;
			//--- sampleRate
			self.DATA.PARAMS.CODA.SAMPLERATE = coda[0].data.getUint32(22);
			//--- numChannels
			self.DATA.PARAMS.CODA.NUMCHANNELS = coda[0].data.getUint16(16);
			//--- sampleSize
			self.DATA.PARAMS.CODA.SAMPLESIZE = coda[0].data.getUint16(18);
		}

		//--- AVG DURATION -----------------------------------------------------

		arr = [];
		if (self.DATA.PARAMS.DURATION.MDHD_0) arr.push(self.DATA.PARAMS.DURATION.MDHD_0);
		if (self.DATA.PARAMS.DURATION.TKHD_0) arr.push(self.DATA.PARAMS.DURATION.TKHD_0);
		if (self.DATA.PARAMS.DURATION.ELST_0) arr.push(self.DATA.PARAMS.DURATION.ELST_0);
		if (self.DATA.PARAMS.DURATION.TKHD_1) arr.push(self.DATA.PARAMS.DURATION.TKHD_1);
		if (self.DATA.PARAMS.DURATION.ELST_1) arr.push(self.DATA.PARAMS.DURATION.ELST_1);
		if (self.DATA.PARAMS.DURATION.MVHD) arr.push(self.DATA.PARAMS.DURATION.MVHD);
		self.DATA.PARAMS.DURATION.AVG = arr.median();

		arr = [];
		if (self.DATA.PARAMS.DURATION.MDHD_0) arr.push(self.DATA.PARAMS.DURATION.MDHD_0);
		if (self.DATA.PARAMS.DURATION.TKHD_0) arr.push(self.DATA.PARAMS.DURATION.TKHD_0);
		if (self.DATA.PARAMS.DURATION.ELST_0) arr.push(self.DATA.PARAMS.DURATION.ELST_0);
		if (self.DATA.PARAMS.DURATION.MVHD) arr.push(self.DATA.PARAMS.DURATION.MVHD);
		self.DATA.PARAMS.DURATION.AVG_0 = arr.median();

		arr = [];
		if (self.DATA.PARAMS.DURATION_TKHD_1) arr.push(self.DATA.PARAMS.DURATION_TKHD_1);
		if (self.DATA.PARAMS.DURATION_ELST_1) arr.push(self.DATA.PARAMS.DURATION_ELST_1);
		self.DATA.PARAMS.DURATION.AVG_1 = arr.median();

		arr = [];
		if (self.DATA.PARAMS.TIMESCALE.MDHD_0) arr.push(self.DATA.PARAMS.TIMESCALE.MDHD_0);
		if (self.DATA.PARAMS.TIMESCALE.MVHD) arr.push(self.DATA.PARAMS.TIMESCALE.MVHD);
		self.DATA.PARAMS.TIMESCALE.AVG_0 = arr.median();

		arr = [];
		if (self.DATA.PARAMS.TIMESCALE.MDHD_1) arr.push(self.DATA.PARAMS.TIMESCALE.MDHD_1);
		if (self.DATA.PARAMS.CODA.SAMPLERATE) arr.push(self.DATA.PARAMS.CODA.SAMPLERATE);
		self.DATA.PARAMS.TIMESCALE.AVG_1 = arr.median();

		if (self.DATA.PARAMS.DURATION.AVG_0 && self.DATA.PARAMS.TIMESCALE.AVG_0) {
			self.DATA.PARAMS.RATIO.AVG_0 = self.DATA.PARAMS.DURATION.AVG_0 / self.DATA.PARAMS.TIMESCALE.AVG_0;
		}

		if (self.DATA.PARAMS.DURATION.MDHD_1 && self.DATA.PARAMS.TIMESCALE.MDHD_1) {
			self.DATA.PARAMS.RATIO.AVG_1 = self.DATA.PARAMS.DURATION.MDHD_1 / self.DATA.PARAMS.TIMESCALE.MDHD_1;
		}

		arr = [];
		if (self.DATA.PARAMS.TRACKWIDTH.TKHD_0) arr.push(self.DATA.PARAMS.TRACKWIDTH.TKHD_0);
		if (self.DATA.PARAMS.TRACKWIDTH.CODV) arr.push(self.DATA.PARAMS.TRACKWIDTH.CODV);
		self.DATA.PARAMS.TRACKWIDTH.AVG = arr.median();

		arr = [];
		if (self.DATA.PARAMS.TRACKHEIGHT.TKHD_0) arr.push(self.DATA.PARAMS.TRACKHEIGHT.TKHD_0);
		if (self.DATA.PARAMS.TRACKHEIGHT.CODV) arr.push(self.DATA.PARAMS.TRACKHEIGHT.CODV);
		self.DATA.PARAMS.TRACKHEIGHT.AVG = arr.median();

		//--- DURATION ---------------------------------------------------------

		arr = [];
		if (self.DATA.PARAMS.DURATION.MVHD) arr.push(self.DATA.PARAMS.DURATION.MVHD);
		if (self.DATA.PARAMS.DURATION.TKHD_0) arr.push(self.DATA.PARAMS.DURATION.TKHD_0);
		if (self.DATA.PARAMS.DURATION.TKHD_1) arr.push(self.DATA.PARAMS.DURATION.TKHD_1);
		if (arr.length) {
			self.DATA.PARAMS.DURATION.MAIN = Math.min.apply(null, arr);
		}

		//--- FRAMES NUMBER ----------------------------------------------------

		if (self.DATA.PARAMS.DURATION.MAIN) {
			let length = self.DATA.PARAMS.DURATION.MAIN / self.DATA.PARAMS.TIMESCALE.MVHD;
			self.DATA.PARAMS.TRACKLENGTH.MVHD = Math.round(length * 100) / 100;
			self.DATA.INFO.TRACK_TIME_LENGTH = self.DATA.PARAMS.TRACKLENGTH.MVHD;

			let samplesNumV = self.DATA.PARAMS.SAMPLES.STSZ_V_NUMBER || self.DATA.PARAMS.SAMPLES.STTS_V_NUMBER;
			if (samplesNumV) {
				self.DATA.PARAMS.SAMPLES.V_FRAMERATE = Math.round((samplesNumV / length) * 1000) / 1000;
				self.DATA.INFO.TRACK_NUM_FRAMES = samplesNumV;
				self.DATA.INFO.TRACK_FRAME_RATE = self.DATA.PARAMS.SAMPLES.V_FRAMERATE;
			}
		}

		//--- FTYP

		atoms = self.findAtoms('ftyp');
		if (atoms.length) {
			//--- ftyp: major brand
			atoms[0].entries = [];
			atoms[0].entries.push(atoms[0].data.getString(0, 4).padEnd(4, ' '));
			val = atoms[0].data.getUint32(4);
			atoms[0].entries.push(val.toString().padStart(8, '0'));
			for (let i = 0; i < (atoms[0].size - 16) / 4; i++) {
				if (atoms[0].data.isString(8 + i * 4, 4)) {
					val = atoms[0].data.getString(8 + i * 4, 4).padEnd(4, ' ');
					atoms[0].entries.push(val);
				} else {
					break;
				}
			}
			self.DATA.PARAMS.FTYP = atoms[0].entries.join(',');
			if (atoms[0].entries.length) {
				self.DATA.CHECKS.FTYP = true;
			}
		}
		callback(true);
	}

	//--------------------------------------------------------------------------

	getFrameInfo(index) {
		const self = this;
		let stsc = self.findTrAtoms('stsc', 0);
		let stsz = self.findTrAtoms('stsz', 0);
		let stco = self.findTrAtoms(['stco', 'co64'], 0);

		if (stsc.length && stsz.length && stco.length && self.DATA.CHUNKS.length) {
			let numFrames = stsz[0].sample_count;
			if (index > 0 && index <= numFrames) {
				let chunkVideo = self.DATA.CHUNKS.find(c => c.trak === 0 && index >= c.samples.start && index < c.samples.start + c.samples.count);
				if (chunkVideo) {
					let pos = index - chunkVideo.samples.start;
					let chunkAudio = self.DATA.CHUNKS.find(c => c.trak === 1 && c.offs > chunkVideo.offs);
					let offset = 0;
					let length = 0;
					let res = {
						chunkGlobalOffset: chunkVideo.offs,
						sampleGlobalIndex: index,
						sampleChunkIndex: pos + 1,
						audio: chunkAudio,
						video: chunkVideo
					}
					if (chunkVideo.samples) {
						offset = chunkVideo.samples.sizes.slice(0, pos).reduce((p, c) => p + c, 0);
						length = chunkVideo.samples.sizes[pos];
					}
					res.sampleGlobalOffset = chunkVideo.offs + offset;
					res.sampleChunkOffset = offset;
					res.sampleLength = length;
					return res;
				} else {
					self.vbox.error(self, 'The chunk with the frame is not found');
				}
			} else {
				self.vbox.error(self, 'Frame index is outside the range of available frames');
			}
		} else {
			self.vbox.error(self, 'Unable to retrieve frame information');
		}
		return false;
	}

	//--------------------------------------------------------------------------

	parseAtoms(callback) {
		const self = this;
		let pos = 0;
		let min = 0;
		let max = 0;

		//--- check atoms number

		if (!self.DATA.ATOMS.length) {
			self.vbox.error(self, 'Unsupported format or damaged file');
		}

		//--- sort atoms by their positions

		self.DATA.ATOMS.sort((a, b) => a.pos - b.pos);

		//--- filter false atoms

		self.DATA.ATOMS = self.DATA.ATOMS.filter(a => {
			if (a.name === 'mdat') {
				return (a.size > self.file.size / 2) && (a.size < self.file.size - 1024);
			} else {
				return (a.size < 1024 * 1024);
			}
		});

		let atms = self.findAtoms(self.emptyAtomNames());
		if (atms.length) {
			for (let i = 0; i < atms.length; i++) {
				pos = self.DATA.ATOMS.findIndex(a => a.next === atms[i].next);
				if (pos > -1 || atms[i].last) {
					min = atms[i].pos + 8;
					max = atms[i].next;
					self.DATA.ATOMS = self.DATA.ATOMS.filter(a => !(a.pos >= min && a.next <= max));
				}
			}
		}

		callback(true);
	}

	//--------------------------------------------------------------------------

	calcHeaderSpot(callback) {
		const self = this;
		let pos = 0;
		let atm = 0;
		let arr = ABI7_VBOX_TPL_HEADER_NAMES;
		let med = [];
		let nxt = [];

		self.DATA.ATOMS.forEach(a => {
			if (arr.indexOf(a.name) > -1) {
				med.push(a.pos);
				nxt.push(a.next);
			}
		});

		if (!med.length) {
			self.vbox.errors.push('Header not found');
			return;
		}

		self.DATA.HEADER.spot_center = med.median();
		self.DATA.HEADER.spot_begin = Math.min.apply(null, med);
		self.DATA.HEADER.spot_end = Math.max.apply(null, nxt);
		self.DATA.HEADER.spot_size = self.DATA.HEADER.spot_end - self.DATA.HEADER.spot_begin;
		self.DATA.HEADER.spot_count = med.length;

		let find = self.DATA.ATOMS.find(a => a.pos === self.DATA.HEADER.spot_begin);
		if (find.name != 'moov') {
			for (let i = pos; i >= 0; i--) {
				if (ABI7_VBOX_ATOMS[self.DATA.ATOMS[i].name].levels.includes(0)) {
					self.DATA.HEADER.spot_begin = self.DATA.ATOMS[i].next;
					if (!self.parser.findAtoms('moov').length) {
						atm = new abi7VboxAtom();
						atm.name = 'moov';
						atm.pos = self.DATA.HEADER.spot_begin;
						atm.lost = 1;
						atm.lvl = 0;
						self.DATA.ATOMS.splice(i + 1, 0, atm);
					}
					break;
				}
			}
		}

		self.DATA.ATOMS = self.DATA.ATOMS.filter(a => {
			if (arr.indexOf(a.name) > -1) {
				return ((a.pos > self.DATA.HEADER.spot_begin - 1024 * 5) && (a.pos < self.DATA.HEADER.spot_end + 1024 * 5));
			} else {
				return true;
			}
		});

		callback(true);
	}

	//--------------------------------------------------------------------------

	checkAtomsHealth(callback) {
		const self = this;

		//--- check atom links

		self.DATA.ATOMS.forEach(atom => {
			if (atom.next === self.file.size) {
				atom.atomNext = -1;
			} else {
				let find = self.DATA.ATOMS.find(f => f.pos === atom.next);
				if (find) {
					atom.atomNext = find;
					find.atomPrev = atom;
				} else {
					self.vbox.error(self, 'The next atom in the chain for the atom "' + atom.name + '" is not found');
				}
			}
		});

		let func_check = (id) => {
			let
				atom = 0,
				nums = 0,
				val1 = 0,
				val2 = 0,
				size = 0;

			if (id < self.DATA.ATOMS.length) {
				atom = self.DATA.ATOMS[id];

				//--- check ftyp

				if (['ftyp'].indexOf(atom.name) > -1) {
					/*
					for (let i = 0; i < codecs.length; i++) {
						codc = codecs[i];
						arr = Array.from(atom.data.subarray(0, codc.ftyp.length));
						if (codc.ftyp.equals(arr)) {
							atom.codec = codc.name;
							self.DATA.PARAMS.CODEC_DATA = codc;
							break;
						}
					}
					*/
					func_check(id + 1);
				}

				//--- check stco atoms

				else if (['stco', 'co64'].indexOf(atom.name) > -1) {
					size = (atom.name === 'co64') ? 8 : 4;
					nums = atom.data.getUint32(4);
					atom.entries = [];
					if (nums > 0 && nums < 1024 * 1024) {
						self.readFile(atom.pos + 16, nums * size, buf => {
							if (buf.length == nums * size) {
								val1 = -1;
								for (let i = 0; i < nums; i++) {
									val2 = (size === 8) ? buf.getUint64(i * size) : buf.getUint32(i * size);
									if (val2 > val1 && val2 < self.file.size) {
										atom.entries.push(val2);
										val1 = val2;
									} else {
										atom.broken = 1;
										func_check(id + 1);
										return;
									}
								}
								atom.size = 16 + nums * size;
								atom.min = Math.min.apply(null, atom.entries);
								atom.max = Math.max.apply(null, atom.entries);
								func_check(id + 1);
							} else {
								atom.broken = 1;
								func_check(id + 1);
							}
						});
					} else {
						atom.broken = 1;
						func_check(id + 1);
					}
				}

				//--- check stsz atoms

				else if (['stsz'].indexOf(atom.name) > -1) {
					size = atom.data.getUint32(4);
					nums = atom.data.getUint32(8);
					atom.sample_size = size;
					atom.sample_count = nums;
					atom.entries = [];
					//--- default sample size (if size > 0)
					if (size > 0) {
						atom.size = 20;
						func_check(id + 1);
					} else {
						size = 4;
						atom.size = 20 + nums * size;
						if (nums > 0 && nums < 1024 * 1024) {
							self.readFile(atom.pos + 20, nums * size, buf => {
								if (buf.length === nums * size) {
									for (let i = 0; i < nums; i++) {
										val1 = buf.getUint32(i * size);
										if (val1 > 0) {
											atom.entries.push(val1);
										} else {
											atom.broken = 1;
											func_check(id + 1);
											return;
										}
									}
									func_check(id + 1);
								} else {
									atom.broken = 1;
									func_check(id + 1);
								}
							});
						} else {
							atom.broken = 1;
							func_check(id + 1);
						}
					}
				}

				//--- check ctts & stts atoms

				else if (['ctts', 'stts'].indexOf(atom.name) > -1) {
					size = 8;
					nums = atom.data.getUint32(4);
					atom.size = 16 + nums * size;
					atom.entries = [];
					if (nums > 0 && nums < 1024 * 1024) {
						self.readFile(atom.pos + 16, nums * size, buf => {
							if (buf.length === nums * size) {
								for (let i = 0; i < nums; i++) {
									atom.entries.push({
										smpl_num: buf.getUint32(i * size),
										smpl_dur: buf.getUint32(i * size + 4)
									});
								}
								atom.numSamples = atom.entries.reduce((p, c) => p + c.smpl_num, 0);
								func_check(id + 1);
							} else {
								atom.broken = 1;
								func_check(id + 1);
								return;
							}
						});

					} else {
						atom.broken = 1;
						func_check(id + 1);
					}
				}

				//--- check stsc atoms

				else if (['stsc'].indexOf(atom.name) > -1) {
					size = 12;
					nums = atom.data.getUint32(4);
					atom.size = 16 + nums * size;
					atom.entries = [];
					if (nums > 0 && nums < 1024 * 8) {
						self.readFile(atom.pos + 16, nums * size, buf => {
							if (buf.length === nums * size) {
								for (let i = 0; i < nums; i++) {
									atom.entries.push({
										f_chunk: buf.getUint32(i * size),
										samples: buf.getUint32(i * size + 4),
										smpdesc: buf.getUint32(i * size + 8)
									});
								}
								atom.entries.sort((a, b) => b.f_chunk - a.f_chunk);

								func_check(id + 1);
							} else {
								atom.broken = 1;
								func_check(id + 1);
								return;
							}
						});
					} else {
						atom.broken = 1;
						func_check(id + 1);
					}
				}

				//--- check stss atoms

				else if (['stss'].indexOf(atom.name) > -1) {
					size = 4;
					nums = atom.data.getUint32(4);
					atom.size = 16 + nums * size;
					atom.entries = [];
					if (nums > 0 && nums < 1024 * 8) {
						self.readFile(atom.pos + 16, nums * size, buf => {
							if (buf.length === nums * size) {
								for (let i = 0; i < nums; i++) {
									atom.entries.push(buf.getUint32(i * size))
								}
								atom.entries.sort((a, b) => a - b);
								func_check(id + 1);
							} else {
								atom.broken = 1;
								func_check(id + 1);
								return;
							}
						});
					} else {
						atom.broken = 1;
						func_check(id + 1);
					}
				} else {
					func_check(id + 1);
				}
				
			} else {

				//--- end of check

				self.DATA.ATOMS = self.DATA.ATOMS.filter(a => !a.broken);
				callback(true);
			}
		}

		if (self.DATA.ATOMS.length) {
			func_check(0);
		} else {
			/*
			self.funcScan({
				owner: self,
				action: 'error',
				desc: 'No atoms found'
			});
			*/
			callback(false);
		}
	}

	//--------------------------------------------------------------------------

	parseData(callback) {
		const self = this;
		self.parseAtoms(() => {
			self.checkAtomsHealth(() => {
				self.parseHeaderTracks(() => {
					self.calcHeaderSpot(() => {
						self.parseMediaData(() => {
							callback(self);
						});
					});
				});
			});
		});
	}

	//--------------------------------------------------------------------------

}


class abi7Vbox {
	constructor(file, options) {
		const self = this;
		if (!('File' in window && file instanceof File)) {
			throw new Error('Invalid file parameter!');
		}
		self.defaults = {
			ignoreErrors: true,	
			events: {
				onParsing: false,
				onParsingStart: false,
				onParsingEnd: false
			}
		}
		self.config = Object.assign({}, self.defaults, options);
		for (let prop in options) {
			if (typeof options[prop] === 'object' && !Array.isArray(options[prop])) {
				self.config[prop] = Object.assign({}, self.defaults[prop], options[prop]);
			}
		}
		self.events = self.config.events;
		self.status = ABI7_VBOX_STATUS_NONE;
		self.errors = [];
		self.file = file;
	}

	error(obj, value) {
		const self = this;
		let text = obj.constructor.name + ': ' + value;
		if (self.config.ignoreErrors) {
			self.errors.push(text);
		} else {
			throw new Error(text);
		}
	}

	parse(fdone) {
		const self = this;
		self.parser = new abi7VboxParser(self, fdone);
	}

	setStatus(value) {
		const self = this;
		if (self.status !== value) {
			self.status = value;
		}
	}
}
