import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import zipfile, os, re, json

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "beta_output")

def parse_osu(text):
    section = None
    general, metadata, timing, objects = {}, {}, [], []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("//"): continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]; continue
        if section == "General" and ":" in line:
            k,v=line.split(":",1); general[k.strip()]=v.strip()
        elif section == "Metadata" and ":" in line:
            k,v=line.split(":",1); metadata[k.strip()]=v.strip()
        elif section == "TimingPoints":
            p=line.split(",")
            if len(p)>=2:
                try: timing.append((float(p[0]),float(p[1])))
                except: pass
        elif section == "HitObjects":
            p=line.split(",")
            if len(p)>=3:
                try:
                    x,t=int(p[0]),int(float(p[2]))
                    typ=int(p[3]) if len(p)>3 else 1
                    objects.append((x,t,typ))
                except: pass
    return general, metadata, timing, objects

def safe(s):
    s=re.sub(r"[^A-Za-z0-9 _-]+","",s).strip().lower()
    return re.sub(r"\s+","-",s) or "song"

def bpm_from_timing(timing):
    bpms=[60000/b for _,b in timing if b>0 and 150<=b<=2000]
    return round(sum(bpms)/len(bpms),3) if bpms else 120

def patterns(notes):
    by={}
    for t,l in notes: by.setdefault(t,[]).append(l)
    times=sorted(by)
    c={k:0 for k in ("streams","jacks","chords","rolls","staircases","long_notes")}
    for t in times:
        if len(by[t])>=2: c["chords"]+=1
        if len(set(by[t]))<len(by[t]): c["jacks"]+=1
    for i in range(2,len(times)):
        a,b,d=times[i-2:i+1]
        if 0<b-a and 0<d-b and .75 <= (d-b)/(b-a) <= 1.33: c["streams"]+=1
        if len(by[times[i-1]])==1 and len(by[d])==1 and abs(by[times[i-1]][0]-by[d][0])==1:
            c["staircases"]+=1
    for i in range(1,len(times)):
        if times[i]-times[i-1] <= 90: c["rolls"]+=1
    return c

def convert(path):
    if not path.lower().endswith(".osz"): raise ValueError("Select an .osz file.")
    with zipfile.ZipFile(path) as z:
        osu=[n for n in z.namelist() if n.lower().endswith(".osu")]
        if not osu: raise ValueError("No .osu files found.")
        made=[]
        for name in osu:
            text=z.read(name).decode("utf-8-sig","replace")
            g,m,timing,objs=parse_osu(text)
            if int(g.get("Mode","-1")) != 3: continue
            if abs(float(g.get("CircleSize","4"))-4)>0.01: continue
            notes=[(t,min(3,max(0,int(x*4/512)))) for x,t,typ in objs]
            bpm=bpm_from_timing(timing)
            song=safe(m.get("TitleUnicode") or m.get("Title") or os.path.splitext(os.path.basename(path))[0])
            diff=safe(m.get("Version") or "hard")
            pat=patterns(notes)
            chart={"song":{"song":song,"bpm":bpm,"needsVoices":False,"player1":"bf","player2":"dad","gfVersion":"gf","speed":2.0},
                   "notes":[{"sectionNotes":[{"t":t,"d":l,"l":0} for t,l in notes],"lengthInSteps":16,"mustHitSection":True,"typeOfSection":0,"altAnim":False}],
                   "_aiBeta":{"source":"osu!mania .osz","keys":4,"difficulty":diff,"patterns":pat}}
            folder=os.path.join(OUT_DIR,song); os.makedirs(folder,exist_ok=True)
            out=os.path.join(folder,f"{song}-{diff}.json")
            with open(out,"w",encoding="utf-8") as f: json.dump(chart,f,indent=2)
            made.append((diff,bpm,pat,out))
        if not made: raise ValueError("No 4K osu!mania difficulties found.")
        return made

class App:
    def __init__(self,root):
        self.root=root; root.title("AI Mod Center — Beta"); root.geometry("850x560")
        root.configure(bg="#151515")
        tk.Label(root,text="🤖 AI MOD CENTER — BETA",font=("Arial",22,"bold"),fg="white",bg="#151515").pack(pady=(22,4))
        tk.Label(root,text="OSZ-only AI chart pipeline prototype",font=("Arial",11),fg="#aaa",bg="#151515").pack()
        self.logbox=tk.Text(root,bg="#202020",fg="white",insertbackground="white",font=("Consolas",10))
        self.logbox.pack(fill="both",expand=True,padx=30,pady=25)
        bar=tk.Frame(root,bg="#151515"); bar.pack(pady=(0,20))
        ttk.Button(bar,text="🎵 Import .OSZ",command=self.import_osz).pack(side="left",padx=7)
        ttk.Button(bar,text="🧠 AI Analyze",command=self.analyze).pack(side="left",padx=7)
        ttk.Button(bar,text="📦 Output Folder",command=self.open_output).pack(side="left",padx=7)
        self.data=[]

    def log(self,s):
        self.logbox.insert("end",s+"\n"); self.logbox.see("end")

    def import_osz(self):
        p=filedialog.askopenfilename(filetypes=[("osu!mania beatmap",".osz")])
        if not p:return
        try:
            self.data=convert(p); self.logbox.delete("1.0","end")
            self.log("OSZ IMPORTED SUCCESSFULLY\n")
            for diff,bpm,pat,out in self.data:
                self.log(f"Difficulty: {diff}")
                self.log(f"BPM: {bpm}")
                self.log("Patterns: "+", ".join(f"{k}={v}" for k,v in pat.items()))
                self.log(f"JSON: {out}\n")
            self.log("Every 4K difficulty is exported separately.")
            self.log("Beta limitation: audio/mod packaging and real AI generation are not wired in yet.")
        except Exception as e: messagebox.showerror("Import error",str(e))

    def analyze(self):
        if not self.data:
            messagebox.showinfo("AI Analyze","Import an OSZ first."); return
        self.log("\nAI ANALYSIS")
        for diff,bpm,pat,out in self.data:
            dominant=max(pat,key=pat.get)
            self.log(f"{diff}: dominant detected pattern = {dominant}")

    def open_output(self):
        os.makedirs(OUT_DIR,exist_ok=True)
        try: os.startfile(OUT_DIR)
        except: messagebox.showinfo("Output folder",OUT_DIR)

root=tk.Tk(); App(root); root.mainloop()
