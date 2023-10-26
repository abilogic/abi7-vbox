/**
 * @ Author: Alexander Momot
 * @ Create Time: 2023-04-03 08:13:17
 * @ Modified by: Alexander Momot
 * @ Modified time: 2023-10-24 09:54:25
 * @ Description: Vbox Utils
 */

/**
 * Clone Class
 */

const ABI7_VBOX_REQUEST_BYTES = 1024 * 1024 * 1024 * 8;

class abi7VboxClone {
	constructor(vbox, options, callback) {
		let self = this;
		self.vbox = vbox;
		self.file = vbox.file;
		self.parser = vbox.parser;
		self.defaults = {
		}
		self.config = Object.assign({}, self.defaults, options);
		self.callback = callback;
		self.init();
	}

	//--------------------------------------------------------------------------

	init() {
		let self = this;

		self.origin = {
			samples: {
				0: self.parser.DATA.CHUNKS.filter(c => c.trak === 0).reduce((p, c) => p + c.samples.sizes.length, 0),
				1: self.parser.DATA.CHUNKS.filter(c => c.trak === 1).reduce((p, c) => p + c.samples.sizes.length, 0)
			}
		}

		self.chunks = self.parser.DATA.CHUNKS.filter(chunk => {
			let res = true;
			if (self.config.frameStart) {
				res = (chunk.offs >= self.config.frameStart.chunkGlobalOffset);
			}
			if (res && self.config.frameEnd) {
				res = (chunk.offs <= self.config.frameEnd.chunkGlobalOffset);
			}
			return res;
		});

		if (!self.chunks.length) {
			self.vbox.error(self, 'No chunks were found');
		}

		if (self.config.frameEnd) {
			let chunk2 = self.config.frameEnd.video;
			if (chunk2) {
				chunk2.size = (self.config.frameEnd.sampleChunkOffset + self.config.frameEnd.sampleLength);
				if (chunk2.samples) {
					chunk2.samples.count = self.config.frameEnd.sampleChunkIndex;
					chunk2.samples.sizes.splice(self.config.frameEnd.sampleChunkIndex);
				}
			}
		}

		if (self.config.frameStart) {
			let chunk1 = self.config.frameStart.video;
			if (chunk1) {
				chunk1.size -= self.config.frameStart.sampleChunkOffset;
				chunk1.offs = self.config.frameStart.sampleGlobalOffset;
				if (chunk1.samples) {
					chunk1.samples.start = self.config.frameStart.sampleGlobalIndex;
					chunk1.samples.count -= (self.config.frameStart.sampleChunkIndex - 1);
					chunk1.samples.sizes.splice(0, self.config.frameStart.sampleChunkIndex - 1);
				}
			}
		}

		//--- calculate chunk offsets

		let offs = 0;
		self.chunks.forEach(c => {
			c.calcOffset = offs;
			offs += c.size;
		});

		//--- calculate duration

		let funcSTTS = (name, trak) => {
			let stts = self.parser.findTrAtoms(name, trak);
			let chunks = self.chunks.filter(c => c.trak === trak);
			let out = [];
			if (stts.length && chunks.length) {
				let arr = [];
				let samplesIndex = Math.min.apply(null, chunks.map(c => c.samples.start));
				let samplesCount = chunks.reduce((p, c) => p + c.samples.sizes.length, 0);
				let entries = stts[0].entries;

				entries.forEach(e => {
					for (let i = 0; i < e.smpl_num; i++) {
						arr.push(e.smpl_dur);
					}
				});

				arr = arr.slice(samplesIndex - 1, samplesIndex + samplesCount - 1);
				let i = 0;
				while (i < arr.length) {
					let val = arr[i];
					let num = 0;
					while (i < arr.length && arr[i] === val) {
						num++;
						i++;
					}
					if (num) {
						out.push({
							smpl_num: num,
							smpl_dur: val
						});
					}
				}
			}
			return out;
		}

		let ctts_0 = funcSTTS('ctts', 0);
		let ctts_1 = funcSTTS('ctts', 1);
		let stts_0 = funcSTTS('stts', 0);
		let stts_1 = funcSTTS('stts', 1);

		self.tracks = {
			0: {
				ctts: ctts_0,
				stts: stts_0,
				samples: stts_0.reduce((p, c) => p + c.smpl_num, 0),
				duration: stts_0.reduce((p, c) => p + c.smpl_num * c.smpl_dur, 0)
			},
			1: {
				ctts: ctts_1,
				stts: stts_1,
				samples: stts_1.reduce((p, c) => p + c.smpl_num, 0),
				duration: stts_1.reduce((p, c) => p + c.smpl_num * c.smpl_dur, 0)
			}
		}

		//--- global duration

		if (self.parser.DATA.PARAMS.DURATION.MVHD) {
			self.durationMVHD = Math.round((self.parser.DATA.PARAMS.DURATION.MVHD / self.origin.samples[0]) * self.tracks[0].samples);
			console.log('dur', self.durationMVHD);
		}

		self.dataSize = self.chunks.reduce((p, c) => p + c.size, 0);
		console.log('datasize', self.dataSize);

		self.buildHeader(() => {
			self.buildFile(() => {
				self.callback(self);
			});
		});
	}

	//--------------------------------------------------------------------------

	buildHeader(callback) {
		let self = this;
		let ver = 0;
		let atoms = 0;
		let NODES = ABI7_VBOX_TPL_FILE;
		//let NODES = JSON.parse(JSON.stringify(ABI7_VBOX_TPL_FILE));

		let func_calcNode = function (id) {
			let
				node = NODES[id],
				len = node.size;

			if (node.len) { return node.len }

			for (let i in NODES) {
				if (i != id && NODES[i].par == id) {
					len += func_calcNode(i);
				}
			}
			//console.log('---', node, len);
			node.buf.setSize(len);
			node.len = len;
			return len;
		}

		let func_copyData = function (node, atoms, fdone) {
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName(node.name);
			if (atoms.length) {
				if (node.size > ABI7_VBOX_ATOM_BUFFER_SIZE + 8) {
					self.parser.readFile(atoms[0].pos + 8, node.size - 8, function (buf) {
						node.buf.setArray(buf, 8);
						fdone();
					});
				} else {
					node.buf.setArray(atoms[0].data.subarray(0, node.size - 8), 8);
					fdone();
				}
			} else {
				fdone();
			}
		}

		//--- ctts & stts boxes

		let func_copyXTTS = function (node, atoms, fdone) {
			let xtts = self.tracks[node.trak][node.name];

			node.size = 16 + xtts.length * 8;
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName(node.name);
			node.buf.setUint32(xtts.length, 12);

			xtts.forEach((val, i) => {
				node.buf.setUint32(val.smpl_num, 16 + i * 8);
				node.buf.setUint32(val.smpl_dur, 20 + i * 8);
			});

			fdone();
		}

		let func_copySTSC = function (node, atoms, fdone) {
			let chunks = self.chunks.filter(c => c.trak === node.trak);
			let arr = [];
			let count = 0;
			chunks.forEach((c, i) => {
				if (c.samples.sizes.length !== count) {
					count = c.samples.sizes.length;
					arr.push({
						f_chunk: i + 1,
						samples: count,
						smpdesc: 1
					});
				}
			});
			let nums = arr.length;

			node.size = 16 + nums * 12;
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName(node.name);
			node.buf.setUint32(nums, 12);

			arr.forEach((a, i) => {
				let offs = i * 12;
				node.buf.setUint32(a.f_chunk, offs + 16);
				node.buf.setUint32(a.samples, offs + 20);
				node.buf.setUint32(a.smpdesc, offs + 24);
			});
			fdone();
		}

		let func_copySTSS = function (node, atoms, fdone) {
			let sample1 = (self.config.frameStart) ? self.config.frameStart.sampleGlobalIndex : 1;
			let sample2 = (self.config.frameEnd) ? self.config.frameEnd.sampleGlobalIndex : self.tracks[node.trak].samples;
			let shift = (sample1 - 1);

			let entries = ((atoms.length) ? atoms[0].entries : []).filter(e => (e - shift) > 0).map(e => e - shift).filter(e => e <= sample2);

			if (!entries.includes(1)) {
				entries.unshift(1);
			}

			node.size = 16 + entries.length * 4;
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName(node.name);
			node.buf.setUint32(entries.length, 12);

			entries.forEach((e, i) => {
				node.buf.setUint32(e, 16 + i * 4);
			});

			/*
			let chunks = self.chunks.filter(c => c.trak === node.trak);



			node.size = 16 + chunks.length * 4;
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName(node.name);
			node.buf.setUint32(chunks.length, 12);

			let index = 1;
			chunks.forEach((c, i) => {
				node.buf.setUint32(index, 16 + i * 4);
				index += c.samples.sizes.length;
			});
			*/
			fdone();
		}

		let func_copySTSZ = function (node, atoms, fdone) {
			let nums = 0;
			let chunks = self.chunks.filter(c => c.trak === node.trak);
			if (chunks.length) {
				nums = chunks.reduce((p, c) => p + c.samples.count, 0);
			}

			node.size = 20 + nums * 4;
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName(node.name);
			node.buf.setUint32(nums, 16);

			let i = 0;
			chunks.forEach(c => {
				c.samples.sizes.forEach(s => {
					node.buf.setUint32(s, 20 + i * 4);
					i++;
				});
			});
			fdone();
		}

		let func_copySTCO = function (node, atoms, fdone) {
			let chunks = self.chunks.filter(c => c.trak === node.trak);
			let nums = (atoms.length) ? chunks.length : 0;
			//let nums = (atoms.length) ? atoms[0].entries.length : 0;

			node.size = 16 + nums * 8;
			node.buf = new Uint8Array(node.size);
			node.buf.setSize(node.size);
			node.buf.setName('co64');
			node.buf.setUint32(nums, 12);

			chunks.forEach((c, i) => node.buf.setUint64(c.calcOffset, 16 + i * 8));
			fdone();
		}

		let func_buildNode = function (id, fdone) {
			let NODE = (NODES.hasOwnProperty(id)) ? NODES[id] : false;

			if (!NODE) {
				fdone();
				return 1;
			}

			if (NODE.copy) {

				if (id === ATM_FTYP_0) {
					atoms = self.parser.findAtoms(NODE.name);
					NODE.size = (atoms.length) ? atoms[0].size : 24;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_UUID_0) {
					NODE.size = 24;
					NODE.buf = new Uint8Array(NODE.size);
					NODE.buf.setSize(NODE.size);
					NODE.buf.setName(NODE.name);
					// Ver & Flags
					NODE.buf.setArray([0, 0, 0, 1], 8);
					NODE.buf.setString('abilogic', 12);
					func_buildNode(id + 1, fdone);
					return 1;
				}

				if (id === ATM_MVHD_0) {
					atoms = self.parser.findAtoms(NODE.name);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.size = (atoms.length) ? atoms[0].size : ((ver) ? 120 : 108);
					func_copyData(NODE, atoms, () => {
						if (self.durationMVHD) {
							NODE.buf.setUint32(self.durationMVHD, 24);
						}
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_TKHD_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : ((ver) ? 104 : 92);
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_EDTS_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 36;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_MDHD_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : ((ver) ? 40 : 32);
					func_copyData(NODE, atoms, () => {
						NODE.buf.setUint32(self.tracks[0].duration, 24);
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_HDLR_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0).slice(-1);
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 52;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_VMHD_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 20;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_DREF_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 28;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSD_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					NODE.size = 16; //--- important
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_CODV_1) {
					atoms = self.parser.findTrAtoms(ABI7_VBOX_TPL_VCODEC, 0);
					NODE.trak = 0;
					if (atoms.length) {
						NODE.size = atoms[0].size;
						NODE.name = atoms[0].name;
						func_copyData(NODE, atoms, () => {
							func_buildNode(id + 1, fdone);
						});
					} else {
						/*
						if (self.__DATA.PARAMS.CODEC_DATA && self.__DATA.PARAMS.CODEC_DATA.stsd0) {
							NODE.size = self.__DATA.PARAMS.CODEC_DATA.stsd0.length - 8;
							NODE.buf = new Uint8Array(NODE.size);
							NODE.buf.setArray(self.__DATA.PARAMS.CODEC_DATA.stsd0.slice(8));
							NODE.name = NODE.buf.getString(4, 4);
						} else {
							NODE.size = 16;
							NODE.name = 'avc1';
							NODE.buf = new Uint8Array(NODE.size);
							NODE.buf.setSize(NODE.size);
							NODE.buf.setName(NODE.name);
						}
						func_buildNode(id + 1, fdone);
						*/
					}
					return 1;
				}

				if (id === ATM_CTTS_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					func_copyXTTS(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STTS_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					func_copyXTTS(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSC_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					func_copySTSC(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSZ_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					func_copySTSZ(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STCO_1) {
					atoms = self.parser.findTrAtoms('stco', 0);
					NODE.trak = 0;
					if (!atoms.length) {
						atoms = self.parser.findTrAtoms('co64', 0);
						if (atoms.length) {
							NODE.name = 'co64';
						}
					}
					func_copySTCO(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSS_1) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 0;
					func_copySTSS(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				//--- AUDIO ----------------------------------------------------

				if (id === ATM_TKHD_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : ((ver) ? 104 : 92);
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_EDTS_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 36;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_MDHD_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					ver = (atoms.length) ? atoms[0].data.getVersion(0) : 0;
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : ((ver) ? 40 : 32);
					func_copyData(NODE, atoms, () => {
						NODE.buf.setUint32(self.tracks[1].duration, 24);
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_HDLR_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1).slice(-1);
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 52;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_SMHD_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_DREF_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 0);
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 28;
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSD_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					NODE.trak = 1;
					NODE.size = 16; //--- important
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_CODA_2) {
					atoms = self.parser.findTrAtoms(ABI7_VBOX_TPL_ACODEC, 1);
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					NODE.name = (atoms.length) ? atoms[0].name : 'mp4a';
					func_copyData(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STTS_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					func_copyXTTS(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSC_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					NODE.trak = 1;
					NODE.size = (atoms.length) ? atoms[0].size : 16;
					func_copySTSC(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STSZ_2) {
					atoms = self.parser.findTrAtoms(NODE.name, 1);
					NODE.trak = 1;
					func_copySTSZ(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_STCO_2) {
					atoms = self.parser.findTrAtoms('stco', 1);
					NODE.trak = 1;
					if (!atoms.length) {
						atoms = self.parser.findTrAtoms('co64', 1);
						if (atoms.length) {
							NODE.name = 'co64';
						}
					}
					func_copySTCO(NODE, atoms, () => {
						func_buildNode(id + 1, fdone);
					});
					return 1;
				}

				if (id === ATM_FREE_0) {
					NODE.len = 1024;
					NODE.size = 1024;
					NODE.buf = new Uint8Array(NODE.size);
					NODE.buf.setName(NODE.name);
					NODE.buf.setSize(NODE.size);
					func_buildNode(id + 1, fdone);
					return 1;
				}

				//--- MDAT -----------------------------------------------------

				if (id === ATM_MDAT_0) {
					NODE.len = 16;
					NODE.size = 16;
					NODE.buf = new Uint8Array(NODE.size);
					NODE.buf.setName(NODE.name);
					NODE.buf.setUint32(1, 0);
					NODE.buf.setUint64(NODE.size + self.dataSize, 8);
					func_buildNode(id + 1, fdone);
					return 1;
				}

			} else {
				if (id === ATM_TRAK_1 && !self.parser.DATA.PARAMS.TRACK_0.length) {
					NODE.name = 'skip';
				}
				if (id === ATM_TRAK_2 && !self.parser.DATA.PARAMS.TRACK_1.length) {
					NODE.name = 'skip';
				}
				NODE.size = 8;
				NODE.buf = new Uint8Array(NODE.size);
				NODE.buf.setSize(NODE.size);
				NODE.buf.setName(NODE.name);
				func_buildNode(id + 1, fdone);
				return 1;
			}
		}

		func_buildNode(0, () => {
			let atms = 0;
			let num = 0;
			let val = 0;
			let pos = 0;
			let offs = 0;
			let mdat = 0;
			let stco = 0;
			let size = 0;

			for (let i in NODES) {
				func_calcNode(i);
			}
			size = 0;
			for (let i in NODES) {
				NODES[i].pos = size;
				size += NODES[i].size;
			}

			//--- recalc stco offsets
			atms = self.parser.findAtoms('mdat');
			if (atms.length) {
				mdat = NODES[ATM_MDAT_0];
				offs = mdat.pos + 16;

				stco = NODES[ATM_STCO_1];
				num = stco.buf.getUint32(12);
				for (let i = 0; i < num; i++) {
					val = stco.buf.getUint64(16 + i * 8);
					stco.buf.setUint64(val + offs, 16 + i * 8)
				}

				stco = NODES[ATM_STCO_2];
				num = stco.buf.getUint32(12);
				for (let i = 0; i < num; i++) {
					val = stco.buf.getUint64(16 + i * 8);
					stco.buf.setUint64(val + offs, 16 + i * 8)
				}

				/*
				offs = (atms[0].pos - mdat.pos) + (atms[0].data_offs - 16);

				stco = NODES[ATM_STCO_1];
				num = stco.buf.getUint32(12);
				for (let i = 0; i < num; i++) {
					val = stco.buf.getUint64(16 + i * 8);
					stco.buf.setUint64(val - offs, 16 + i * 8)
				}

				stco = NODES[ATM_STCO_2];
				num = stco.buf.getUint32(12);
				for (let i = 0; i < num; i++) {
					val = stco.buf.getUint64(16 + i * 8);
					stco.buf.setUint64(val - offs, 16 + i * 8)
				}
				*/
			}

			//--- output buffer

			self.__OUTPUT = new Uint8Array(size);
			for (let i in NODES) {
				self.__OUTPUT.set(NODES[i].buf, pos);
				pos += NODES[i].buf.length;
			}

			callback(NODES);
		});
	}

	//--------------------------------------------------------------------------

	parseMDAT(callback) {
		let self = this;
		let mdat = self.parser.findAtoms('mdat');

		if (mdat.length) {

			let func_chunk = (offset) => {
				if (offset < mdat[0].size) {
					self.parser.readFile(offset, 128, buf => {
						let chunkSize = buf.getUint32BE(0);
						let chunkData = buf.slice(8);

						console.log(chunkData);

						// Determine whether the chunk contains audio or video data
						if (chunkData[0] === 0xFF && (chunkData[1] & 0xF0) === 0xF0) {
							// The chunk contains audio data (AAC format)
							console.log(`Found audio chunk, size=${chunkSize}`);
						} else if (chunkData[0] === 0x00 && chunkData[1] === 0x00 && chunkData[2] === 0x01 && (chunkData[3] & 0x1F) === 0x07) {
							// The chunk contains video data (H.264 or MPEG-4 format)
							console.log(`Found video chunk, size=${chunkSize}`);
						} else {
							// The chunk does not contain audio or video data
							console.log(`Found unknown chunk, size=${offset}`);
						}
						func_chunk(offset + 4 + chunkSize);
					});
				}
			}
			func_chunk(mdat[0].pos + mdat[0].data_offs);
		}
		if (callback) {
			callback();
		}
	}

	//--------------------------------------------------------------------------

	buildFile(callback) {
		let self = this;
		let tmpName = 'video.tmp';

		let func_error = (e) => {
			self.vbox.error(self, 'window.requestFileSystem error');
		}

		let func_delete = (fs, fname, fdone) => {
			fs.root.getFile(fname, { create: false }, fileEntry => {
				fileEntry.remove(() => {
					fdone();
				},
					() => { fdone() });
			},
				() => { fdone() });
		}

		let func_write_header = (fs, fname, fdone) => {
			fs.root.getFile(fname, { create: true }, fileEntry => {
				fileEntry.createWriter(fileWriter => {
					fileWriter.onwriteend = (e) => {
						fdone();
					}
					fileWriter.write(new Blob([self.__OUTPUT], { type: 'application/octet-stream' }));
				});
			});
		}

		let func_write = (fs, fname, fdone) => {
			/*
			let atm = self.parser.findAtoms('mdat');
			let pos = atm[0].pos + atm[0].data_offs;
			let len = atm[0].size - atm[0].data_offs;

			console.log('mdat_new', {pos, len});
			*/

			let pos = Math.min.apply(null, self.chunks.map(c => c.offs));
			let len = self.dataSize;

			let func_fread = () => {
				if (len > 0) {
					self.parser.readFile(pos, Math.min(len, ABI7_VBOX_CHUNK_SIZE), (buf) => {
						pos += buf.length;
						len -= buf.length;

						fs.root.getFile(fname, {}, fileEntry => {
							fileEntry.createWriter(fileWriter => {
								fileWriter.onwriteend = (e) => {
									func_fread();
								}
								fileWriter.seek(fileWriter.length);
								fileWriter.write(new Blob([buf], { type: 'application/octet-stream' }));
							});
						});
					});
				}
				else {
					fdone();
				}
			}

			func_fread();
		}

		let func_initFS = (fs) => {
			func_delete(fs, tmpName, () => {
				func_write_header(fs, tmpName, () => {
					func_write(fs, tmpName, () => {
						callback();
					});
				});
			});
		}

		window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
		window.requestFileSystem(TEMPORARY, ABI7_VBOX_REQUEST_BYTES, func_initFS, func_error);
	}

	//--------------------------------------------------------------------------

	download() {
		let self = this;
		let fname = 'video.tmp';
		let fArr = self.file.name.split('.');
		let newName = fArr[0] + '-repaired.' + fArr[1];
		let func_downFILE = function (file, fileName) {
			let
				url = window.URL.createObjectURL(file);
			func_downURL(url, fileName);
			setTimeout(() => {
				return window.URL.revokeObjectURL(url);
			}, 1000);
		}

		let func_downURL = function (url, fileName) {
			let
				a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.style = 'display: none';
			a.click();
			a.remove();
		}

		let func_error = function (e) {
			console.log(e);
		}
		let func_initFS = function (fs) {
			fs.root.getFile(fname, {}, function (fileEntry) {
				fileEntry.file(function (file) {
					func_downFILE(file, newName);
				});
			});
		}

		//--- begin
		window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
		window.requestFileSystem(TEMPORARY, 1024 * 1024, func_initFS, func_error);
	}
}

/**
 * Cut Class
 */

class abi7VboxCut {
	constructor(vbox) {
		let self = this;
		self.vbox = vbox;
		self.file = vbox.file;
		self.parser = vbox.parser;
	}

	//--------------------------------------------------------------------------

	frames(start, end, callback) {
		let self = this;
		start = Math.max(1, start || 1);
		end = Math.min(self.parser.DATA.INFO.TRACK_NUM_FRAMES, end || self.parser.DATA.INFO.TRACK_NUM_FRAMES);
		if (end >= start) {
			let frame1 = self.parser.getFrameInfo(start);
			let frame2 = self.parser.getFrameInfo(end);

			if (frame1 && frame2) {
				new abi7VboxClone(self.vbox, {
					frameStart: frame1,
					frameEnd: frame2
				}, callback);
			} else {
				self.vbox.error(self, 'One or both frames are not found in the media file');
			}
		} else {
			self.vbox.error(self, 'End frame must be equal or greater than start frame');
		}
	}

	//--------------------------------------------------------------------------

	time(start, end, callback) {
		let self = this;
	}
}

/**
 * Samples Class
 */

class abi7VboxSample {
	constructor() {

	}
}

class abi7VboxSamples {
	constructor(vbox, callback) {
		let self = this;
		self.vbox = vbox;
		self.file = vbox.file;
		self.parser = vbox.parser;
		self.samples = [];
		self.init(callback);
	}

	//--------------------------------------------------------------------------

	init(callback) {
		let self = this;
		let chunks = self.parser.DATA.CHUNKS;
		let func = (index) => {
			if (index < chunks.length) {
				let chunk = chunks[index];
				self.parser.readFile(chunk.origin.offset, chunk.origin.size, buf => {
					let offset = 0;
					chunk.samples.sizes.forEach(size => {
						let data = buf.subarray(offset, offset + 24);
						self.samples.push({
							trak: chunk.trak,
							text: data.getBytesStr(0),
							offs: offset,
							size,
							data,
							chunk
						});
						offset += size;
					});
					func(index + 1);
				});
			}
			else {
				callback(self.samples);
			}
		}

		func(0);
	}
}

/**
 * Tree Class
 */

class abi7VboxTree {
	constructor(vbox, callback) {
		let self = this;
		self.vbox = vbox;
		self.file = vbox.file;
		self.parser = vbox.parser;
		self.atoms = self.parser.DATA.ATOMS;
		self.tree = { name: 'root', lvl: -1, atoms: [] };
		self.init(callback);
	}

	//--------------------------------------------------------------------------

	setAtomLinks(id, to, level, parent) {
		let self = this;
		let free = 0;
		let stc = 0;
		let atm = 0;
		let nxt = 0;

		while (id < self.atoms.length && id > -1 && id < to) {
			atm = self.atoms[id];
			atm.lvl = level;
			atm.parent = parent;
			stc = { name: atm.name, lvl: level, atoms: [] };
			parent.atoms.push(stc);
			free = (ABI7_VBOX_ATOMS_FREE.indexOf(atm.name) > -1);
			if (!free && !ABI7_VBOX_ATOMS[atm.name].levels.includes(level)) {
				atm.error = 'Invalid Level';
				self.vbox.errors.push('Atom "' + atm.name + '": Invalid Level');
			}
			nxt = id;
			id = (atm.last) ? self.atoms.length : self.atoms.findIndex(a => a.pos === atm.next);
			if (id > nxt) {
				if (!free && nxt + 1 < self.atoms.length && nxt + 1 < id) {
					self.setAtomLinks(nxt + 1, id, level + 1, stc);
				}
			} else {
				if (atm.next != self.file.size) {
					self.vbox.errors.push('Atom "' + atm.name + '": Next atom not found');
				}
				break;
			}
		}
	}

	//--------------------------------------------------------------------------

	init (callback) {
		let self = this;

		self.setAtomLinks(0, 10000, 0, self.tree);

		let OUT = {};
		let func_tree = (stc) => {
			let ch = [];
			stc.atoms.forEach(s => {
				let arr;
				let sub = ((s.atoms.length) ? func_tree(s) : []);
				let name = s.name + '_' + s.lvl;
				if (s.lvl > -1) {
					if (OUT[name]) {
						arr = OUT[name].concat(sub);
						OUT[name] = arr.filter((item, pos) => arr.indexOf(item) === pos);
					} else {
						OUT[name] = sub;
					}
					ch.push(s.name);
				}
			});

			return ch.filter((value, index, a) => a.indexOf(value) === index);
		}
		func_tree(self.tree);
		if (callback) {
			callback(self.tree);
		}
	}
}


/**
 * Utils Summary Class
 */

class abi7VboxUtils {
	constructor(vbox, options) {
		let self = this;
		self.vbox = vbox;
		self.file = vbox.file;
		self.parser = vbox.parser;
		self.defaults = {
		}
		self.config = Object.assign({}, self.defaults, options);
		self.init();
	}

	//--------------------------------------------------------------------------

	init() {
		let self = this;
	}

	//--------------------------------------------------------------------------

	getAtomsTree(callback) {
		let self = this;
		new abi7VboxTree(self, callback);
	}

	//--------------------------------------------------------------------------

	getSamples(callback) {
		let self = this;
		new abi7VboxSamples(self, callback);
	}

	//--------------------------------------------------------------------------
	
	clone(options, callback) {
		let self = this;
		new abi7VboxClone(self, options, callback);
	}

	//--------------------------------------------------------------------------

	cutFrames(start, end, callback) {
		let self = this;
		let cut = new abi7VboxCut(self.vbox);
		cut.frames(start, end, callback);
	}

	//--------------------------------------------------------------------------

	cutTime(start, end, callback) {
		let self = this;
		let cut = new abi7VboxCut(self.vbox);
		cut.time(start, end, callback);
	}
}
