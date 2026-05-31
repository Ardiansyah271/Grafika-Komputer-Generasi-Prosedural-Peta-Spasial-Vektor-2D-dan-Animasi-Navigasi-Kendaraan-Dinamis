// ============================================================
//  tracker.js — Animasi & Navigasi Kendaraan
//  Mata Kuliah : INF11114 Grafika Komputer — UMRAH
//  Semester    : Genap 2025/2026
//  Dosen       : Tekad Matulatan & Nolan Efranda
// ============================================================
//  Kontributor : Rydhoi Trimaniel Lase (2401020061)
//  Peran       : Animasi & Navigasi
//  Modul       : /pathfinding  /animation
// ============================================================
//
//  DESKRIPSI:
//  File ini mengelola navigasi kendaraan utama dari titik
//  asal ke tujuan menggunakan jalur terpendek, serta
//  menganimasikan pergerakan kendaraan di atas kurva jalan
//  dengan kecepatan dan orientasi yang selalu sinkron.
//
//  ALGORITMA & TEKNIK GRAFIKA:
//
//  1. DIJKSTRA SHORTEST PATH
//     Mencari rute terpendek antar node menggunakan
//     priority queue (min-heap). Bobot edge = panjang
//     busur Bézier (arc-length approximation 10 sample).
//     Kompleksitas: O((V+E) log V).
//
//  2. ARC-LENGTH PARAMETERIZATION
//     Parameter t pada Bézier tidak linear terhadap jarak.
//     Arc-length LUT memetakan jarak tempuh → t yang tepat
//     sehingga kecepatan kendaraan konstan secara visual.
//     Mencegah efek akselerasi/deselerasi di tikungan.
//
//  3. TANGENT-BASED ROTATION (ORIENTASI KENDARAAN)
//     Sudut hadap dihitung dari turunan B'(t) = vektor
//     tangent kurva Bézier, lalu di-smooth dengan
//     interpolasi sudut berbasis delta time.
//     Mencegah efek drifting — sesuai spesifikasi RPM.
//
//  4. SPEED EASING — START / PAUSE
//     Kecepatan di-ease halus saat pause (decelerate)
//     dan resume (accelerate) menggunakan lerp delta time.
//     Fitur Start/Pause sesuai fitur wajib RPM INF11114.
//
//  REFERENSI:
//  - Cormen et al. (2009) Introduction to Algorithms
//  - Shirley & Marschner (2009) Fundamentals of CG
// ============================================================
// tracker.js v3 — Multi-vehicle + Trail effect

// ── VEHICLE DEFINITIONS ───────────────────────────────────────
const VEHICLE_DEFS = {
    car: {
        label: 'Mobil', emoji: '🚗',
        baseSpeed: 700,
        draw(ctx, scale, color, detail) {
            const cw = 40 * scale, ch = 22 * scale;
            // Shadow
            ctx.save(); ctx.translate(4*scale, 5*scale); ctx.scale(1, 0.5);
            ctx.beginPath(); ctx.ellipse(0, 0, cw*.65, ch*.9, 0, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
            // Body
            ctx.fillStyle = color || '#2a6db5';
            ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 5*scale); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
            // Roof
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.roundRect(-cw/2+5*scale, -ch/2+2*scale, cw-12*scale, ch-4*scale, 4*scale); ctx.fill();
            // Windshield
            ctx.fillStyle = 'rgba(160,220,255,0.7)';
            ctx.beginPath(); ctx.roundRect(cw/2-11*scale, -ch/2+3*scale, 9*scale, ch-6*scale, 2*scale); ctx.fill();
            // Headlights
            ctx.fillStyle = 'rgba(255,245,180,0.95)'; ctx.shadowColor = 'rgba(255,245,180,0.8)'; ctx.shadowBlur = 10*scale;
            ctx.fillRect(cw/2-2*scale, -ch/2+2*scale, 3*scale, 5*scale);
            ctx.fillRect(cw/2-2*scale, ch/2-7*scale, 3*scale, 5*scale);
            // Taillights
            ctx.fillStyle = 'rgba(255,50,50,0.9)'; ctx.shadowColor = 'rgba(255,50,50,0.8)'; ctx.shadowBlur = 8*scale;
            ctx.fillRect(-cw/2, -ch/2+2*scale, 3*scale, 5*scale);
            ctx.fillRect(-cw/2, ch/2-7*scale, 3*scale, 5*scale);
            ctx.shadowBlur = 0;
            // Wheels
            ctx.fillStyle = '#111';
            const wr = [[-cw/2+5*scale,-ch/2-3*scale],[cw/2-9*scale,-ch/2-3*scale],[-cw/2+5*scale,ch/2+1*scale],[cw/2-9*scale,ch/2+1*scale]];
            wr.forEach(([wx,wy]) => { ctx.beginPath(); ctx.roundRect(wx, wy, 8*scale, 4*scale, 1); ctx.fill(); });
        }
    },
    truck: {
        label: 'Truk', emoji: '🚛',
        baseSpeed: 380,
        draw(ctx, scale, color, detail) {
            const cw = 70 * scale, ch = 26 * scale;
            // Trailer
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw*0.62, ch, 3*scale); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.stroke();
            // Corrugation lines on trailer
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
            for(let i=1; i<4; i++) {
                const rx = -cw/2 + (cw*0.62/4)*i;
                ctx.beginPath(); ctx.moveTo(rx, -ch/2); ctx.lineTo(rx, ch/2); ctx.stroke();
            }
            // Cab
            ctx.fillStyle = color || '#8B0000';
            ctx.beginPath(); ctx.roundRect(-cw/2 + cw*0.62 - 2*scale, -ch/2, cw*0.38+2*scale, ch, 5*scale); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();
            // Windshield
            ctx.fillStyle = 'rgba(160,220,255,0.65)';
            ctx.beginPath(); ctx.roundRect(cw/2-11*scale, -ch/2+3*scale, 9*scale, ch-6*scale, 2*scale); ctx.fill();
            // Headlights
            ctx.fillStyle = 'rgba(255,245,180,0.95)'; ctx.shadowColor = 'rgba(255,245,160,0.8)'; ctx.shadowBlur = 12*scale;
            ctx.fillRect(cw/2-2*scale, -ch/2+3*scale, 3*scale, 5*scale);
            ctx.fillRect(cw/2-2*scale, ch/2-8*scale, 3*scale, 5*scale);
            ctx.shadowBlur = 0;
            // Taillights
            ctx.fillStyle = 'rgba(255,50,50,0.9)';
            ctx.fillRect(-cw/2, -ch/2+3*scale, 3*scale, 5*scale);
            ctx.fillRect(-cw/2, ch/2-8*scale, 3*scale, 5*scale);
            // Wheels (6)
            ctx.fillStyle = '#111';
            const wx = [-cw/2+5*scale, -cw/2+cw*0.3, cw/2-10*scale];
            wx.forEach(x => {
                ctx.beginPath(); ctx.roundRect(x, -ch/2-3*scale, 9*scale, 5*scale, 1); ctx.fill();
                ctx.beginPath(); ctx.roundRect(x, ch/2, 9*scale, 5*scale, 1); ctx.fill();
            });
        }
    },
    bus: {
        label: 'Bus', emoji: '🚌',
        baseSpeed: 280,
        draw(ctx, scale, color, detail) {
            const cw = 62 * scale, ch = 22 * scale;
            ctx.fillStyle = color || '#e8b84b';
            ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 4*scale); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
            // Windows row
            ctx.fillStyle = 'rgba(160,220,255,0.55)';
            for(let i = 0; i < 5; i++) {
                ctx.beginPath(); ctx.roundRect(-cw/2+8*scale+i*10*scale, -ch/2+3*scale, 7*scale, ch-6*scale, 2*scale); ctx.fill();
            }
            // Headlights
            ctx.fillStyle = 'rgba(255,245,160,0.9)'; ctx.shadowColor = 'rgba(255,245,160,0.8)'; ctx.shadowBlur = 10*scale;
            ctx.fillRect(cw/2-2*scale, -ch/2+2*scale, 2*scale, 5*scale);
            ctx.fillRect(cw/2-2*scale, ch/2-7*scale, 2*scale, 5*scale);
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(220,50,50,0.85)';
            ctx.fillRect(-cw/2, -ch/2+2*scale, 2*scale, 5*scale);
            ctx.fillRect(-cw/2, ch/2-7*scale, 2*scale, 5*scale);
            // Wheels
            ctx.fillStyle = '#111';
            [[-cw/2+6*scale,-ch/2-3*scale],[cw/2-14*scale,-ch/2-3*scale],[-cw/2+6*scale,ch/2],[cw/2-14*scale,ch/2]].forEach(([wx2,wy2]) => {
                ctx.beginPath(); ctx.roundRect(wx2, wy2, 10*scale, 5*scale, 1); ctx.fill();
            });
        }
    },
    motor: {
        label: 'Motor', emoji: '🏍️',
        baseSpeed: 820,
        draw(ctx, scale, color, detail) {
            const cw = 28 * scale, ch = 12 * scale;
            // Shadow
            ctx.save(); ctx.translate(2*scale, 4*scale); ctx.scale(1, 0.4);
            ctx.beginPath(); ctx.ellipse(0, 0, cw*.7, ch*1.2, 0, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
            // Body
            ctx.fillStyle = color || '#e74c3c';
            ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 4*scale); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
            // Fairing
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.roundRect(-cw/2+2*scale, -ch/2, cw*0.3, ch, 3*scale); ctx.fill();
            // Windshield
            ctx.fillStyle = 'rgba(180,230,255,0.7)';
            ctx.beginPath(); ctx.roundRect(cw/2-8*scale, -ch/2+1*scale, 6*scale, ch-2*scale, 2*scale); ctx.fill();
            // Headlight
            ctx.fillStyle = 'rgba(255,245,180,0.95)'; ctx.shadowColor = 'rgba(255,245,160,0.9)'; ctx.shadowBlur = 10*scale;
            ctx.beginPath(); ctx.arc(cw/2-2*scale, 0, 3*scale, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            // Wheels
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(-cw/2+4*scale, 0, 5*scale, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cw/2-4*scale, 0, 5*scale, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(-cw/2+4*scale, 0, 5*scale, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cw/2-4*scale, 0, 5*scale, 0, Math.PI*2); ctx.stroke();
        }
    },
    bicycle: {
        label: 'Sepeda', emoji: '🚲',
        baseSpeed: 320,
        draw(ctx, scale, color, detail) {
            const cw = 22 * scale, ch = 8 * scale;
            // Shadow
            ctx.save(); ctx.translate(1*scale, 3*scale); ctx.scale(1, 0.35);
            ctx.beginPath(); ctx.ellipse(0, 0, cw*.8, ch*1.5, 0, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.restore();
            // Frame
            ctx.strokeStyle = color || '#27ae60'; ctx.lineWidth = 2.5*scale; ctx.lineCap = 'round';
            // Wheels
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(-cw/2+3*scale, 0, 5*scale, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cw/2-3*scale, 0, 5*scale, 0, Math.PI*2); ctx.fill();
            // Rim
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(-cw/2+3*scale, 0, 5*scale, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cw/2-3*scale, 0, 5*scale, 0, Math.PI*2); ctx.stroke();
            // Frame lines
            ctx.strokeStyle = color || '#27ae60'; ctx.lineWidth = 2*scale;
            ctx.beginPath();
            ctx.moveTo(-cw/2+3*scale, 0); ctx.lineTo(0, -ch/2-1*scale); ctx.lineTo(cw/2-3*scale, 0);
            ctx.moveTo(0, -ch/2-1*scale); ctx.lineTo(0, 0); ctx.lineTo(-cw/2+3*scale, 0);
            ctx.stroke();
            // Handlebar
            ctx.beginPath(); ctx.moveTo(cw/2-3*scale, -ch/2); ctx.lineTo(cw/2-7*scale, -ch/2); ctx.stroke();
            // Rider (small dot)
            ctx.fillStyle = 'rgba(255,220,180,0.9)';
            ctx.beginPath(); ctx.arc(-1*scale, -ch/2-4*scale, 3.5*scale, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(-1*scale, -ch/2-1*scale, 2.5*scale, 0, Math.PI); ctx.fill();
        }
    },
    person: {
        label: 'Orang', emoji: '🚶',
        baseSpeed: 180,
        draw(ctx, scale, color, detail) {
            const s = scale;
            // Shadow
            ctx.save(); ctx.translate(2*s, 8*s); ctx.scale(1, 0.3);
            ctx.beginPath(); ctx.ellipse(0, 0, 7*s, 5*s, 0, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
            // Head
            ctx.fillStyle = 'rgba(255,220,180,0.95)';
            ctx.beginPath(); ctx.arc(0, -18*s, 6*s, 0, Math.PI*2); ctx.fill();
            // Torso
            ctx.fillStyle = color || '#3498db';
            ctx.beginPath(); ctx.roundRect(-5*s, -12*s, 10*s, 14*s, 2*s); ctx.fill();
            // Legs (animated walk)
            ctx.strokeStyle = '#555'; ctx.lineWidth = 3*s; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-2*s, 2*s); ctx.lineTo(-4*s, 14*s);
            ctx.moveTo(2*s, 2*s); ctx.lineTo(4*s, 14*s);
            ctx.stroke();
            // Arms
            ctx.strokeStyle = color || '#3498db'; ctx.lineWidth = 2.5*s;
            ctx.beginPath();
            ctx.moveTo(-5*s, -10*s); ctx.lineTo(-9*s, 0);
            ctx.moveTo(5*s, -10*s); ctx.lineTo(9*s, 0);
            ctx.stroke();
        }
    }
};

// ── TRACKER MANAGER ───────────────────────────────────────────
class TrackerManager {
    constructor(city) {
        this.city = city;
        this.startNode = null;
        this.goalNode  = null;
        this.path      = [];
        this.tracker   = null;
        this.pickPhase = 0;
        this.isTracking = false;
        this.isPaused   = false;
        this.vehicleType = 'car';
        this.vehicleScale = 1.0;
        this.showTrail = true;
        this.btnStart = document.getElementById('btn-start-track');
        this.btnPause = document.getElementById('btn-pause');
    }

    setVehicleType(type) {
        this.vehicleType = type;
        document.getElementById('stat-vtype').textContent = VEHICLE_DEFS[type]?.label || type;
    }
    setVehicleScale(s) { this.vehicleScale = s; }
    setTrail(v) { this.showTrail = v; }

    handlePick(wx, wy) {
        if (this.isTracking) return;
        let nearest=null, minD=Infinity;
        for (const n of this.city.nodes) {
            const d = (n.x-wx)**2+(n.y-wy)**2;
            if (d<minD) { minD=d; nearest=n; }
        }
        if (minD > 350*350) return;
        if (this.pickPhase===0) {
            this.startNode=nearest; this.goalNode=null; this.path=[]; this.pickPhase=1;
        } else {
            if (nearest.id===this.startNode.id) return;
            this.goalNode=nearest; this.pickPhase=0; this.calculatePath();
        }
    }

    randomizePositions() {
        if (this.isTracking) return;
        if (!this.city||this.city.nodes.length<2) return;
        for (let a=0;a<40;a++) {
            let s=Math.floor(Math.random()*this.city.nodes.length);
            let g=Math.floor(Math.random()*this.city.nodes.length);
            while(g===s) g=Math.floor(Math.random()*this.city.nodes.length);
            this.startNode=this.city.nodes[s];
            this.goalNode =this.city.nodes[g];
            this.pickPhase=0; this.path=[];
            this.calculatePath();
            if (this.path.length>0) { this.updateRouteStats(); return; }
        }
    }

    calculatePath() {
        if (!this.startNode||!this.goalNode) return;
        const dist=new Map(), prev=new Map(), unv=new Set();
        for (const n of this.city.nodes) { dist.set(n.id,Infinity); unv.add(n.id); }
        dist.set(this.startNode.id, 0);
        while (unv.size>0) {
            let u=null, md=Infinity;
            for (const id of unv) { const d=dist.get(id); if(d<md){md=d;u=id;} }
            if (u===null||u===this.goalNode.id) break;
            unv.delete(u);
            const node=this.city.nodes.find(n=>n.id===u);
            for (const e of node.edges) {
                const nb=e.n1.id===u?e.n2:e.n1;
                if (!unv.has(nb.id)) continue;
                const w=this.edgeLen(e);
                const alt=dist.get(u)+w;
                if (alt<dist.get(nb.id)){dist.set(nb.id,alt);prev.set(nb.id,{edge:e,fromId:u});}
            }
        }
        if (!prev.has(this.goalNode.id)){this.path=[];return;}
        const res=[]; let cur=this.goalNode.id;
        while(cur!==this.startNode.id){
            const p=prev.get(cur);
            res.push({edge:p.edge, direction:p.edge.n1.id===p.fromId?1:-1});
            cur=p.fromId;
        }
        this.path=res.reverse();
        this.updateRouteStats();
    }

    edgeLen(e) {
        const A=e.n1,B=e.n2,C=e.cp;
        return (Math.hypot(C.x-A.x,C.y-A.y)+Math.hypot(B.x-C.x,B.y-C.y)+Math.hypot(B.x-A.x,B.y-A.y))/2;
    }

    updateRouteStats() {
        if (!this.path||this.path.length===0) return;
        const totalLen = this.path.reduce((s,p)=>s+this.edgeLen(p.edge),0);
        const km = (totalLen/100).toFixed(2);
        const def = VEHICLE_DEFS[this.vehicleType];
        const speed = (def?.baseSpeed || 700) * (parseFloat(document.getElementById('speedSlider').value)||1.6);
        const sec   = Math.round(totalLen/speed);
        const mins  = Math.floor(sec/60), secs2=sec%60;
        document.getElementById('stat-length').textContent = km + ' km';
        document.getElementById('stat-nodes').textContent  = this.path.length+1;
        document.getElementById('stat-time').textContent   = mins+' menit '+secs2+' detik';
    }

    startTracking() {
        if (!this.startNode||!this.goalNode||!this.path.length) return;
        this.isTracking=true; this.isPaused=false;
        this.btnPause.textContent='⏸ Pause';
        this.btnPause.style.background = '';
        this.tracker = new TrackerVehicle(this.path, this, this.vehicleType, this.vehicleScale);
    }
    togglePause() {
        if (!this.isTracking) return;
        this.isPaused = !this.isPaused;
        this.btnPause.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
        this.btnPause.style.background = this.isPaused ? 'rgba(0,180,80,0.25)' : '';
    }
    onTrackingFinished() {
        this.isTracking=false; this.isPaused=false; this.tracker=null;
        this.startNode=null; this.goalNode=null; this.path=[]; this.pickPhase=0;
        this.btnPause.textContent='⏸ Pause';
        this.btnPause.style.background = '';
    }

    update(dt) { this.tracker && this.tracker.update(dt, this.isPaused); }

    draw(ctx, view, zoom) {
        // Route highlight
        if (this.path.length>0) {
            ctx.save();
            ctx.lineCap='round'; ctx.lineJoin='round';
            ctx.lineWidth=60; ctx.strokeStyle='rgba(0,220,100,0.15)';
            ctx.beginPath();
            let first=true;
            for (const s of this.path) {
                const e=s.edge;
                if(first){const st=s.direction===1?e.n1:e.n2;ctx.moveTo(st.x,st.y);first=false;}
                const en=s.direction===1?e.n2:e.n1;
                ctx.quadraticCurveTo(e.cp.x,e.cp.y,en.x,en.y);
            }
            ctx.stroke();
            ctx.lineWidth=18; ctx.strokeStyle='#00dc64';
            ctx.shadowColor='#00dc64'; ctx.shadowBlur=20;
            ctx.beginPath(); first=true;
            for (const s of this.path) {
                const e=s.edge;
                if(first){const st=s.direction===1?e.n1:e.n2;ctx.moveTo(st.x,st.y);first=false;}
                const en=s.direction===1?e.n2:e.n1;
                ctx.quadraticCurveTo(e.cp.x,e.cp.y,en.x,en.y);
            }
            ctx.stroke();
            ctx.shadowBlur=0;
            ctx.restore();
        }
        // Flags
        if (this.startNode) this.drawFlag(ctx, this.startNode.x, this.startNode.y, '#ff2244', 'S');
        if (this.goalNode)  this.drawFlag(ctx, this.goalNode.x,  this.goalNode.y,  '#00dc64', 'G');
        // Tracker (draws trail + vehicle)
        this.tracker && this.tracker.draw(ctx, view, zoom, this.showTrail);
    }

    drawFlag(ctx, x, y, color, label) {
        ctx.save();
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=5;
        ctx.beginPath(); ctx.moveTo(x+3,y+3); ctx.lineTo(x+3,y-90+3); ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-90); ctx.stroke();
        ctx.fillStyle=color;
        ctx.beginPath(); ctx.moveTo(x,y-90); ctx.lineTo(x+55,y-68); ctx.lineTo(x,y-46); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle='#fff'; ctx.font='bold 22px Inter'; ctx.textAlign='center';
        ctx.fillText(label, x+22, y-62);
        ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2);
        ctx.fillStyle=color; ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=3; ctx.stroke();
        ctx.beginPath(); ctx.arc(x,y,18,0,Math.PI*2);
        ctx.strokeStyle=color+'55'; ctx.lineWidth=4; ctx.stroke();
        ctx.restore();
    }
}

// ── TRACKER VEHICLE ───────────────────────────────────────────
class TrackerVehicle {
    constructor(path, manager, vehicleType, vehicleScale) {
        this.path = path;
        this.manager = manager;
        this.vehicleType = vehicleType;
        this.vehicleScale = vehicleScale;
        this.pathIndex = 0;
        this.edge = path[0].edge;
        this.direction = path[0].direction;
        this.t = this.direction===1 ? 0 : 1;
        this.baseSpeed = (VEHICLE_DEFS[vehicleType]?.baseSpeed || 700)
                       * (parseFloat(document.getElementById('speedSlider').value) || 1.6);
        this.speed = 0;
        this.x = 0; this.y = 0; this.angle = 0; this.targetAngle = 0;

        // Trail: array of {x, y, age} world positions
        this.trail = [];
        this.trailMaxLen = 120;
        this.trailTimer = 0;

        // Pick a consistent color per tracker instance
        const cols = ['#2a6db5','#e74c3c','#8e44ad','#16a085','#d35400','#2ecc71','#e67e22'];
        this.color = cols[Math.floor(Math.random() * cols.length)];

        this.calcLen(); this.updatePos(); this.angle = this.targetAngle;
    }

    calcLen() {
        const A=this.edge.n1, B=this.edge.n2, C=this.edge.cp;
        this.length = (Math.hypot(C.x-A.x,C.y-A.y)+Math.hypot(B.x-C.x,B.y-C.y)+Math.hypot(B.x-A.x,B.y-A.y))/2;
    }

    updatePos() {
        const A=this.edge.n1, B=this.edge.n2, C=this.edge.cp, t=this.t, mt=1-t;
        this.x = mt*mt*A.x + 2*mt*t*C.x + t*t*B.x;
        this.y = mt*mt*A.y + 2*mt*t*C.y + t*t*B.y;
        const dx = 2*mt*(C.x-A.x) + 2*t*(B.x-C.x);
        const dy = 2*mt*(C.y-A.y) + 2*t*(B.y-C.y);
        this.targetAngle = Math.atan2(dy, dx) + (this.direction===-1 ? Math.PI : 0);
    }

    update(dt, paused) {
        // Speed easing
        if (paused) {
            this.speed = Math.max(0, this.speed - this.baseSpeed * dt * 8);
        } else {
            this.speed += (this.baseSpeed - this.speed) * dt * 5;
        }

        if (this.speed > 0) {
            this.t += this.speed / this.length * dt * this.direction;
            let end = false;
            if (this.direction===1 && this.t>=1) { this.t=1; end=true; }
            else if (this.direction===-1 && this.t<=0) { this.t=0; end=true; }
            if (end) {
                this.pathIndex++;
                if (this.pathIndex >= this.path.length) { this.manager.onTrackingFinished(); return; }
                this.edge = this.path[this.pathIndex].edge;
                this.direction = this.path[this.pathIndex].direction;
                this.t = this.direction===1 ? 0 : 1;
                this.calcLen();
            }
        }
        this.updatePos();

        // Smooth angle
        let diff = this.targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI*2;
        while (diff < -Math.PI) diff += Math.PI*2;
        this.angle += diff * Math.min(1, dt*14);

        // Record trail every few ms
        if (!paused) {
            this.trailTimer += dt;
            if (this.trailTimer > 0.035) {
                this.trailTimer = 0;
                this.trail.push({ x: this.x, y: this.y, age: 0 });
                if (this.trail.length > this.trailMaxLen) this.trail.shift();
            }
            // Age trail points
            for (const p of this.trail) p.age += dt;
        }
    }

    draw(ctx, view, zoom, showTrail) {
        // ── TRAIL ──────────────────────────────────────────────
        if (showTrail && this.trail.length > 2) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw segmented dashed trail with fading opacity
            const segLen = 4; // points per dash segment
            for (let i = 1; i < this.trail.length; i++) {
                const p0 = this.trail[i-1], p1 = this.trail[i];
                const prog = i / this.trail.length; // 0=oldest 1=newest
                // Only draw every other segment to create dashes
                const dashOn = Math.floor(i / 3) % 2 === 0;
                if (!dashOn) continue;
                const alpha = prog * prog * 0.75; // quadratic fade
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.strokeStyle = `rgba(0,220,100,${alpha})`;
                ctx.lineWidth = 8 + prog * 10;
                ctx.stroke();
            }

            // Glowing dot at trail head (newest point)
            if (this.trail.length > 0) {
                const last = this.trail[this.trail.length-1];
                ctx.beginPath(); ctx.arc(last.x, last.y, 14, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(0,220,100,0.12)'; ctx.fill();
            }
            ctx.restore();
        }

        // ── VEHICLE ────────────────────────────────────────────
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const def = VEHICLE_DEFS[this.vehicleType] || VEHICLE_DEFS.car;
        const scale = this.vehicleScale;
        const detail = zoom > 0.25;

        def.draw(ctx, scale, this.color, detail);

        ctx.restore();
    }
}

