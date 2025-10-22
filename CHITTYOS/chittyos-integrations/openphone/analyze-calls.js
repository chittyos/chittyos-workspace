#!/usr/bin/env node
/**
 * OpenPhone Call Data Analysis
 * Analyzes 12,178 calls for business intelligence
 */

const fs = require('fs');
const csv = require('csv-parser');

const stats = {
    total: 0,
    answered: 0,
    voicemails: 0,
    totalMinutes: 0,
    byNumber: {},
    byMonth: {},
    topCallers: {},
    businessHours: 0,
    afterHours: 0
};

fs.createReadStream('openphone_calls.csv')
    .pipe(csv())
    .on('data', (row) => {
        // Skip header rows
        if (row.direction === 'direction' || row.direction === 'incoming') return;
        
        stats.total++;
        
        const duration = parseInt(row.duration) || 0;
        const status = row.status;
        const phoneNumber = row.phoneNumberId;
        const date = new Date(row.createdAtPT);
        const hour = date.getHours();
        const month = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const caller = row.from;
        
        // Duration analysis
        stats.totalMinutes += duration / 60;
        
        // Status analysis
        if (status === 'completed') stats.answered++;
        if (row.type === 'voicemail') stats.voicemails++;
        
        // By phone number
        if (!stats.byNumber[phoneNumber]) {
            stats.byNumber[phoneNumber] = { calls: 0, minutes: 0 };
        }
        stats.byNumber[phoneNumber].calls++;
        stats.byNumber[phoneNumber].minutes += duration / 60;
        
        // By month
        if (!stats.byMonth[month]) {
            stats.byMonth[month] = { calls: 0, minutes: 0 };
        }
        stats.byMonth[month].calls++;
        stats.byMonth[month].minutes += duration / 60;
        
        // Top callers
        if (!stats.topCallers[caller]) {
            stats.topCallers[caller] = { calls: 0, minutes: 0 };
        }
        stats.topCallers[caller].calls++;
        stats.topCallers[caller].minutes += duration / 60;
        
        // Business hours (9 AM - 6 PM)
        if (hour >= 9 && hour <= 18) {
            stats.businessHours++;
        } else {
            stats.afterHours++;
        }
    })
    .on('end', () => {
        console.log('📊 OpenPhone Call Analysis');
        console.log('==========================\n');
        
        console.log('📞 Overall Statistics:');
        console.log(`Total Calls: ${stats.total.toLocaleString()}`);
        console.log(`Answered: ${stats.answered.toLocaleString()} (${((stats.answered/stats.total)*100).toFixed(1)}%)`);
        console.log(`Voicemails: ${stats.voicemails.toLocaleString()} (${((stats.voicemails/stats.total)*100).toFixed(1)}%)`);
        console.log(`Total Minutes: ${Math.round(stats.totalMinutes).toLocaleString()}`);
        console.log(`Avg Call Length: ${(stats.totalMinutes/stats.answered).toFixed(1)} minutes`);
        
        console.log('\n🕐 Call Timing:');
        console.log(`Business Hours (9AM-6PM): ${stats.businessHours.toLocaleString()} (${((stats.businessHours/stats.total)*100).toFixed(1)}%)`);
        console.log(`After Hours: ${stats.afterHours.toLocaleString()} (${((stats.afterHours/stats.total)*100).toFixed(1)}%)`);
        
        console.log('\n📱 By Phone Number:');
        Object.entries(stats.byNumber)
            .sort(([,a], [,b]) => b.calls - a.calls)
            .slice(0, 10)
            .forEach(([number, data]) => {
                console.log(`${number}: ${data.calls} calls (${Math.round(data.minutes)} min)`);
            });
        
        console.log('\n📅 Monthly Activity (Top 12):');
        Object.entries(stats.byMonth)
            .sort(([,a], [,b]) => b.calls - a.calls)
            .slice(0, 12)
            .forEach(([month, data]) => {
                console.log(`${month}: ${data.calls} calls (${Math.round(data.minutes)} min)`);
            });
        
        console.log('\n📞 Top Callers (Top 15):');
        Object.entries(stats.topCallers)
            .sort(([,a], [,b]) => b.calls - a.calls)
            .slice(0, 15)
            .forEach(([caller, data]) => {
                if (caller && caller !== '') {
                    console.log(`${caller}: ${data.calls} calls (${Math.round(data.minutes)} min)`);
                }
            });
        
        // Cost analysis
        const monthlyMinutes = stats.totalMinutes / 24; // Assume 2 years of data
        const twilioCallCost = monthlyMinutes * 0.013; // $0.013/min outbound
        const twilioSMSCost = 100 * 0.0075; // Estimate 100 SMS/month
        const twilioNumberCost = 6 * 1; // $1 per number (estimated 6 numbers)
        const totalTwilioCost = twilioCallCost + twilioSMSCost + twilioNumberCost;
        
        console.log('\n💰 Cost Analysis:');
        console.log(`OpenPhone Current: ~$90/month`);
        console.log(`Twilio Estimated: ~$${Math.round(totalTwilioCost)}/month`);
        console.log(`Monthly Savings: ~$${Math.round(90 - totalTwilioCost)}`);
        console.log(`Annual Savings: ~$${Math.round((90 - totalTwilioCost) * 12)}`);
        
        // Business intelligence
        console.log('\n🧠 Business Intelligence:');
        console.log(`- High call volume (${Math.round(stats.total/24)} calls/month avg)`);
        console.log(`- ${((stats.businessHours/stats.total)*100).toFixed(1)}% calls during business hours`);
        console.log(`- ${((stats.voicemails/stats.total)*100).toFixed(1)}% calls go to voicemail`);
        console.log(`- Average ${(stats.totalMinutes/stats.answered).toFixed(1)} minute call duration`);
        
        // Save detailed report
        const report = {
            summary: {
                totalCalls: stats.total,
                answeredCalls: stats.answered,
                voicemails: stats.voicemails,
                totalMinutes: Math.round(stats.totalMinutes),
                averageCallLength: Math.round(stats.totalMinutes/stats.answered * 100) / 100,
                businessHoursPercentage: Math.round(stats.businessHours/stats.total * 1000) / 10,
                currentMonthlyCost: 90,
                estimatedTwilioCost: Math.round(totalTwilioCost),
                monthlySavings: Math.round(90 - totalTwilioCost),
                annualSavings: Math.round((90 - totalTwilioCost) * 12)
            },
            byNumber: stats.byNumber,
            monthlyActivity: stats.byMonth,
            topCallers: Object.fromEntries(
                Object.entries(stats.topCallers)
                    .sort(([,a], [,b]) => b.calls - a.calls)
                    .slice(0, 50)
            )
        };
        
        fs.writeFileSync('./migration-output/call-analysis.json', JSON.stringify(report, null, 2));
        console.log('\n✅ Detailed analysis saved to ./migration-output/call-analysis.json');
    });