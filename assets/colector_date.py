import requests
import json
import time
import random
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import os
import re

class GeneratorRapid20Min:
    def __init__(self):
        self.folder_baza = Path("InfoBase")
        self.folder_baza.mkdir(exist_ok=True)
        
        self.url = "http://localhost:11434/api/generate"
        self.model = "qwen2.5:3b"  # Cel mai rapid
        
        # ============================================================
        # SUBIECTE EXTINSE
        # ============================================================
        
        self.subiecte = [
            # Tehnologie
            "python", "javascript", "typescript", "java", "c++", "c#", "rust", "go",
            "html", "css", "sass", "tailwind", "bootstrap", "react", "angular", "vue",
            "nodejs", "express", "django", "flask", "fastapi", "spring boot",
            "sql", "mysql", "postgresql", "mongodb", "redis", "sqlite",
            "algoritmi", "structuri de date", "sortare", "cautare", "recursivitate",
            "git", "github", "gitlab", "docker", "kubernetes", "terraform",
            "linux", "bash", "powershell", "vim", "vscode", "intellij",
            "api", "rest", "graphql", "websocket", "grpc", "microservicii",
            "testare", "unit testing", "integration testing", "debugging",
            "design patterns", "solid", "dry", "kiss", "mvc", "mvvm",
            
            # Inteligență artificială
            "machine learning", "deep learning", "retele neuronale", "CNN", "RNN", "LSTM",
            "transformer", "GPT", "BERT", "LLM", "NLP", "computer vision",
            "reinforcement learning", "supervised learning", "unsupervised learning",
            "clustering", "clasificare", "regresie", "antrenare", "validare", "testare",
            "overfitting", "underfitting", "regularizare", "dropout", "batch normalization",
            "gradient descent", "backpropagation", "functii de activare", "ReLU", "sigmoid",
            "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
            
            # Știință
            "fizica", "chimie", "biologie", "matematica", "statistica", "astronomie",
            "geologie", "medicina", "psihologie", "zoologie", "botanica", "genetica",
            "ecologie", "neuroscience", "fiziologie", "anatomie",
            
            # Istorie și cultură
            "istoria romaniei", "istoria europei", "istoria lumii", "razboaie",
            "civilizatii antice", "descoperiri", "istoria artei", "istoria stiintei",
            "arta", "literatura", "filozofie", "religie", "traditii", "obiceiuri",
            "folclor", "mitologie", "muzica clasica", "pictura", "sculptura",
            "arhitectura", "dans", "teatru", "cinema",
            
            # Viață
            "viata de zi cu zi", "familie", "prieteni", "scoala", "serviciu",
            "hobby-uri", "calatorii", "mancare", "sanatate", "sport",
            "film", "muzica", "carti", "jocuri", "tehnologie", "animale",
            "plante", "vremea", "culori", "forme",
            
            # Economie și social
            "economie", "finante", "marketing", "antreprenoriat", "cariera",
            "educatie", "politica", "relatii internationale", "mediu", "energie",
            
            # Geografie
            "romania", "bucuresti", "cluj", "timisoara", "iasi", "constanta",
            "europa", "asia", "africa", "america", "australia", "oceania"
        ]
        
        self.conversatii = []
        self.lock = Lock()
        self.success_count = 0
        self.error_count = 0
        self.total_target = 250000
        
        # ============================================================
        # SALVARE LA FIECARE 20 MINUTE
        # ============================================================
        
        self.timp_ultima_salvare = time.time()
        self.interval_salvare = 5 * 60  # 5 minute
        
        print("="*60)
        print("🔥 GENERATOR RAPID - SALVARE LA 20 MINUTE")
        print("="*60)
        print(f"📊 Model: {self.model}")
        print(f"🎯 Țintă: {self.total_target} exemple")
        print(f"📝 Subiecte: {len(self.subiecte)}")
        print(f"⏱️  Salvare la fiecare: 20 minute")
        print("="*60)
    
    def genereaza_conv(self, subiect):
        """Generează o conversație rapid"""
        prompt = f"""Generează o conversație scurtă despre {subiect}.
        Format EXACT:
        Întrebare: [întrebarea]
        Răspuns: [răspunsul]"""
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "max_tokens": 1000,
            "temperature": random.uniform(0.7, 1.0)
        }
        
        try:
            response = requests.post(self.url, json=payload, timeout=20)
            
            if response.status_code == 200:
                text = response.json()['response'].strip()
                
                input_text = ""
                output_text = ""
                
                for line in text.split('\n'):
                    if 'Întrebare:' in line or 'Intrebare:' in line:
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            input_text = parts[1].strip()
                    elif 'Răspuns:' in line or 'Raspuns:' in line:
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            output_text = parts[1].strip()
                
                if not input_text and not output_text:
                    if '\n\n' in text:
                        parts = text.split('\n\n', 1)
                        if len(parts) >= 2:
                            input_text = parts[0].strip()[:200]
                            output_text = parts[1].strip()[:300]
                    else:
                        input_text = f"Ce este {subiect}?"
                        output_text = text[:300]
                
                # Curăță textul
                input_text = self.curata_text(input_text)
                output_text = self.curata_text(output_text)
                
                if input_text and output_text and len(output_text) > 20:
                    with self.lock:
                        self.success_count += 1
                    return {
                        "input": input_text[:500],
                        "output": output_text[:500]
                    }
                else:
                    with self.lock:
                        self.error_count += 1
                    return None
            else:
                with self.lock:
                    self.error_count += 1
                return None
                
        except Exception as e:
            with self.lock:
                self.error_count += 1
            return None
    
    def curata_text(self, text):
        """Curăță textul de HTML și caractere speciale"""
        if not text:
            return ""
        
        # Elimină tag-uri HTML
        text = re.sub(r'<[^>]+>', '', text)
        
        # Elimină entități HTML
        entitati = [
            ('&lt;', ''), ('&gt;', ''), ('&amp;', 'si'), ('&quot;', '"'),
            ('&#39;', "'"), ('&nbsp;', ' '), ('&ndash;', '-'), ('&mdash;', '-')
        ]
        for ent, lit in entitati:
            text = text.replace(ent, lit)
        
        # Elimină URL-uri
        text = re.sub(r'https?://\S+', '', text)
        text = re.sub(r'www\.\S+', '', text)
        
        # Elimină culori
        text = re.sub(r'color\s*=\s*["\'][^"\']*["\']', '', text)
        text = re.sub(r'#[0-9a-fA-F]{6}', '', text)
        
        # Elimină caractere speciale
        text = re.sub(r'[^\w\s\.\,\!\?\-\'\"]', ' ', text)
        
        # Elimină spații multiple
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def salveaza_date(self):
        """Salvează TOATE datele"""
        fisier = self.folder_baza / "conversations.json"
        
        existing = []
        if fisier.exists():
            try:
                with open(fisier, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
            except:
                pass
        
        total = existing + self.conversatii
        
        with open(fisier, 'w', encoding='utf-8') as f:
            json.dump(total, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 SALVARE LA 20 MINUTE!")
        print(f"   ✅ Salvat {len(self.conversatii)} conversații noi")
        print(f"   📊 Total în fișier: {len(total)} conversații")
        print(f"   ⏰ Timp: {time.strftime('%H:%M:%S')}")
        print()
        
        # Reset conversații (cele vechi sunt deja salvate)
        self.conversatii = []
        self.timp_ultima_salvare = time.time()
        
        return len(total)
    
    def ruleaza(self):
        """Rulează generatorul"""
        print("\n🔥 Încep generarea...")
        print("-"*40)
        
        start_time = time.time()
        max_workers = 12  # MĂRIT pentru viteză maximă
        print(f"🧵 {max_workers} thread-uri în paralel")
        print(f"🎯 Țintă: {self.total_target} exemple")
        print(f"⏱️  Salvare la fiecare 20 minute")
        print("-"*40)
        
        subiecte_list = [random.choice(self.subiecte) for _ in range(self.total_target)]
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self.genereaza_conv, subiect): i
                for i, subiect in enumerate(subiecte_list)
            }
            
            for i, future in enumerate(as_completed(futures)):
                try:
                    conv = future.result()
                    if conv:
                        with self.lock:
                            self.conversatii.append(conv)
                except:
                    pass
                
                # ============================================================
                # VERIFICĂ DACĂ AU TRECUT 20 MINUTE
                # ============================================================
                
                timp_curent = time.time()
                if timp_curent - self.timp_ultima_salvare >= self.interval_salvare:
                    self.salveaza_date()
                
                # Afișează progres la fiecare 100
                if (i + 1) % 100 == 0:
                    elapsed = time.time() - start_time
                    rate = self.success_count / elapsed * 60 if elapsed > 0 else 0
                    timp_ramas_salvare = self.interval_salvare - (time.time() - self.timp_ultima_salvare)
                    minute_ramase = int(timp_ramas_salvare // 60)
                    secunde_ramase = int(timp_ramas_salvare % 60)
                    
                    print(f"   📊 {i+1}/{self.total_target} - ✅{self.success_count} ❌{self.error_count} - {rate:.0f} ex/min")
                    print(f"   ⏰ Următoarea salvare în: {minute_ramase}m {secunde_ramase}s")
        
        # Salvare finală
        if self.conversatii:
            self.salveaza_date()
        
        elapsed = time.time() - start_time
        minutes = int(elapsed // 60)
        hours = minutes // 60
        minutes = minutes % 60
        
        print("\n" + "="*60)
        print("🎉 GENERARE FINALIZATĂ!")
        print("="*60)
        print(f"""
        ⏱️  Timp: {hours}h {minutes}m
        ✅ Reușite: {self.success_count}
        ❌ Eșecuri: {self.error_count}
        """)

if __name__ == "__main__":
    generator = GeneratorRapid20Min()
    generator.ruleaza()