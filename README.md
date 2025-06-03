# AI Specialist Health Consultation Platform

## 👨‍⚕️ Project Description

This web application leverages Google's Gemini AI to provide specialized health consultation insights based on user-submitted questionnaires. Designed with elderly patients (70s) in mind, it aims to offer preliminary diagnostic considerations and guidance across various medical specialties.

**Important:** This application is for **educational and testing purposes only**. It does not provide medical advice or diagnosis. Always consult with a qualified healthcare professional for any health concerns.

## ✨ Features

* **Multi-Specialty Consultation:** Offers specialized consultations for:
    * Respiratory System Diseases
    * General Health
    * Arthritis and Joint Conditions
* **AI-Powered Insights:** Uses Gemini 1.5 Pro to analyze symptoms and generate diagnostic considerations.
* **Specialist Personas:** AI adopts the persona of a specialist with decades of experience in the chosen field.
* **Concise & Fact-Driven Output:** Provides brutally honest, logical, and actionable insights for medical professionals.
* **Korean Language Support:** All AI responses are in Korean.
* **User-Friendly Interface:** Simple web-based questionnaire with clear selection options.

## 🏛️ Architecture Overview

The application follows a simple client-server architecture:

* **Frontend (HTML, CSS, JavaScript):** Static files served by Nginx. Handles user interaction and sends questionnaire data to the backend.
* **Backend (Node.js with Express.js):** Runs on the EC2 instance, managed by PM2. Receives data from the frontend, constructs prompts, calls the Google Gemini API, and returns AI-generated responses.
* **Web Server (Nginx):** Serves static frontend files and acts as a reverse proxy, forwarding API requests to the Node.js backend.
* **AI Model (Google Gemini 1.5 Pro):** Accessed via the Generative Language API.

## 🚀 Deployment Guide

This guide assumes you have an **AWS EC2 instance (Ubuntu 22.04 LTS recommended)** and an SSH key for access.

### **1. Prerequisites & Initial Server Setup**

1.  **Launch EC2 Instance:** Ensure you have an Ubuntu 22.04 LTS EC2 instance running.
2.  **SSH into your instance:**
    ```bash
    ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
    ```
3.  **Update System Packages:**
    ```bash
    sudo apt update -y && sudo apt upgrade -y
    ```
4.  **Install Node.js and npm:**
    ```bash
    curl -fsSL [https://deb.nodesource.com/setup_lts.x](https://deb.nodesource.com/setup_lts.x) | sudo -E bash -
    sudo apt-get install -y nodejs
    ```
5.  **Install Nginx (Web Server):**
    ```bash
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    ```
6.  **Install PM2 (Node.js Process Manager):**
    ```bash
    sudo npm install -g pm2
    ```
7.  **Configure EC2 Security Group (AWS Console):**
    Go to your EC2 instance's Security Group settings in the AWS Console.
    * **Inbound Rule: SSH (Port 22)**, Source: Your IP address (or `0.0.0.0/0` for testing, less secure).
    * **Inbound Rule: HTTP (Port 80)**, Source: `0.0.0.0/0`
    * **Inbound Rule: HTTPS (Port 443)**, Source: `0.0.0.0/0` (Highly Recommended for browser trust).
    * **Inbound Rule: Custom TCP (Port 3000)**, Source: `127.0.0.1/32` (This is for internal communication only, Nginx proxies to it).

### **2. Google Cloud Platform (GCP) Setup**

You need an API key to access Google Gemini models.

1.  **Go to Google Cloud Console:** `console.cloud.google.com`
2.  **Select or Create a Project:** Choose the project you want to use.
3.  **Enable Generative Language API:**
    * Navigate to **APIs & Services** > **Enabled APIs & Services**.
    * Search for **"Generative Language API"**.
    * Ensure it is **"Enabled"**. If not, click to enable it.
4.  **Create an API Key:**
    * Navigate to **APIs & Services** > **Credentials**.
    * Click **"+ CREATE CREDENTIALS"** at the top.
    * Select **"API Key"** from the dropdown.
    * **Copy the generated API Key.** This is crucial.
    * **IMPORTANT:** For "Application restrictions," set it to **"None"** (recommended for server-side calls). If you need to restrict, use "IP addresses" and specify your EC2 instance's public IP (`174.129.70.183`). Do NOT use "HTTP referrers (web sites)" for server-side calls.
    * For "API restrictions," you can leave it as "Don't restrict key" or select "Restrict key" and choose "Generative Language API".
    * Click "SAVE."
5.  **Enable Billing (If you hit quota limits):**
    * If you encounter `429 Too Many Requests` errors, go to **Billing** in GCP.
    * Follow the prompts to "Activate your full account" by setting up a payment method. This lifts free trial quotas.

### **3. Application Deployment & Configuration**

1.  **Clone Your Repository (or Copy Files):**
    * **Option A (Recommended, if your repo is public/private with SSH key):**
        ```bash
        cd /home/ubuntu/
        git clone [https://github.com/jhk1m/digital-health-assistant.git](https://github.com/jhk1m/digital-health-assistant.git)
        cd digital-health-assistant/
        ```
    * **Option B (If copying manually):**
        Create the project directory on EC2: `mkdir /home/ubuntu/digital-health-assistant`
        Then, from your local machine, use `scp` to copy ALL files (including `package.json`, `server.js`, `.env`, all HTMLs, CSS, `main.js`) into `/home/ubuntu/digital-health-assistant/` (except the `.git` folder).

2.  **Navigate to your project directory:**
    ```bash
    cd /home/ubuntu/digital-health-assistant/
    ```

3.  **Install Node.js Dependencies:**
    ```bash
    npm install
    ```
4.  **Configure `.env` file:**
    Create or edit the `.env` file in your project directory:
    ```bash
    nano .env
    ```
    Add your Gemini API Key:
    ```
    GEMINI_API_KEY=YOUR_BRAND_NEW_GEMINI_API_KEY_HERE
    ```
    Save and exit.

5.  **Configure PM2 for System Startup (Crucial for `GEMINI_API_KEY`):**
    First, ensure PM2 is not managing conflicting processes:
    ```bash
    pm2 stop all
    pm2 delete all
    sudo systemctl disable pm2-ubuntu.service # If it exists
    sudo rm /etc/systemd/system/pm2-ubuntu.service
    sudo systemctl daemon-reload
    pm2 kill # Ensure PM2 daemon is fully down
    rm -rf ~/.pm2 # Clean PM2 internal state
    ```
    Then, create the systemd script:
    ```bash
    sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
    ```
    **Get your actual API Key from `.env` (using `cat .env`) and copy the raw key string.**
    Edit the `systemd` service file to inject the API key directly:
    ```bash
    sudo nano /etc/systemd/system/pm2-ubuntu.service
    ```
    Add this line under `[Service]`, before `PIDFile`:
    ```ini
    Environment="GEMINI_API_KEY=YOUR_RAW_API_KEY_STRING_HERE"
    ```
    *(Replace `YOUR_RAW_API_KEY_STRING_HERE` with the actual key value from `.env`)*
    Save and exit. Reload and start systemd service:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl start pm2-ubuntu.service
    ```
    Confirm it's running: `systemctl status pm2-ubuntu.service` should show `active (running)`.

6.  **Start Your Node.js Application with PM2:**
    From your project directory (`/home/ubuntu/digital-health-assistant/`):
    ```bash
    pm2 start server.js --name "questionaire-backend" --cwd /home/ubuntu/digital-health-assistant
    pm2 save
    ```
    Verify: `pm2 status` should show `questionaire-backend` as `online`.

7.  **Copy Frontend Files to Nginx Web Root:**
    ```bash
    sudo cp *.html style.css main.js /var/www/html/
    ```
    Set correct permissions:
    ```bash
    sudo chown -R www-data:www-data /var/www/html
    sudo find /var/www/html -type d -exec chmod 755 {} \;
    sudo find /var/www/html -type f -exec chmod 644 {} \;
    ```

### **4. Nginx Configuration**

1.  **Edit Nginx Default Site Configuration:**
    ```bash
    sudo nano /etc/nginx/sites-available/default
    ```
    Replace its content with the correct `server` block (from previous steps).
    **Ensure the `script` tag references `main.js?v=20250603` in all HTML files locally before copying.**

    ```nginx
    server {
        listen 80;
        listen [::]:80;
        server_name your-domain.com YOUR_EC2_PUBLIC_IP; # Use your domain or 174.129.70.183

        charset utf-8; # Ensure UTF-8 for Korean characters
        # Optional: Redirect HTTP to HTTPS (Uncomment when you have SSL cert)
        # return 301 https://$host$request_uri;

        # Main landing page
        location / {
            root /var/www/html;
            index index.html;
            try_files $uri $uri/ =404;
        }

        # Redirections for clean URLs (e.g., /respiratory -> /respiratory.html)
        location = /respiratory { return 301 /respiratory.html; }
        location = /general { return 301 /general.html; }
        location = /arthritis { return 301 /arthritis.html; }

        # Locations for serving the actual questionnaire HTML files
        location /respiratory.html { root /var/www/html; try_files $uri =404; }
        location /general.html { root /var/www/html; try_files $uri =404; }
        location /arthritis.html { root /var/www/html; try_files $uri =404; }

        # Backend API Proxy
        location /generate-diagnostic {
            proxy_pass [http://127.0.0.1:3000/generate-diagnostic](http://127.0.0.1:3000/generate-diagnostic);
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```

2.  **Test Nginx config and restart:**
    ```bash
    sudo nginx -t
    sudo systemctl restart nginx
    ```

### **5. Final Testing**

1.  **Clear your browser's cache aggressively.**
2.  **Access your public IP/domain.**
3.  **Navigate, fill out, and submit questionnaires.**

---
### **Important Local Git Note:**

After this extensive deployment, remember to commit all your changes to your local Git repository and push them to GitHub.

```bash
cd J:\Projects\digital-health-assistant\
git add .
git commit -m "Final deployment setup and application fixes"
git push -u origin main