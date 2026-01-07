#!/usr/bin/env node

/**
 * Updates the lastUpdated field in projects.json based on 
 * the most recent file modification time in each project folder.
 * 
 * Usage: node update-dates.js
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_JSON = './data/projects.json';
const PROJECTS_DIR = './projects';

function getLatestModTime(dir) {
    if (!fs.existsSync(dir)) return null;
    
    let latest = 0;
    
    function scan(folder) {
        const items = fs.readdirSync(folder);
        for (const item of items) {
            const fullPath = path.join(folder, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scan(fullPath);
            } else {
                if (stat.mtimeMs > latest) {
                    latest = stat.mtimeMs;
                }
            }
        }
    }
    
    scan(dir);
    return latest > 0 ? new Date(latest) : null;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }); // "Jan 7, 2026"
}

function updateDates() {
    // Read projects.json
    const data = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
    let updated = 0;
    
    for (const project of data.projects) {
        // Check if it's an internal project (has a path, not external)
        if (project.path && !project.externalUrl) {
            // Extract folder name from path (e.g., "/projects/brickbreaker/" -> "brickbreaker")
            const match = project.path.match(/\/projects\/([^/]+)/);
            if (match) {
                const folderName = match[1];
                const projectDir = path.join(PROJECTS_DIR, folderName);
                const latestDate = getLatestModTime(projectDir);
                
                if (latestDate) {
                    const newDate = formatDate(latestDate);
                    if (project.lastUpdated !== newDate) {
                        console.log(`${project.title}: ${project.lastUpdated} → ${newDate}`);
                        project.lastUpdated = newDate;
                        updated++;
                    }
                }
            }
        }
    }
    
    if (updated > 0) {
        // Update meta version date
        data.meta.lastUpdated = formatDate(new Date());
        
        // Write back
        fs.writeFileSync(PROJECTS_JSON, JSON.stringify(data, null, 4));
        console.log(`\n✓ Updated ${updated} project(s)`);
    } else {
        console.log('All dates are current.');
    }
}

updateDates();
