import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const MessageSender = () => {
    const [numbers, setNumbers] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fileUploadError, setFileUploadError] = useState(null);
    const [serverStatus, setServerStatus] = useState("unknown");
    const [messageResults, setMessageResults] = useState([]);

    // नंबर को फॉर्मैट करने का फंक्शन
    const formatPhoneNumber = (number) => {
        // सभी स्पेशल कैरेक्टर्स और स्पेस हटाएं
        let cleaned = number.replace(/[^\d]/g, '');
        
        // अगर नंबर में पहले से 91 है तो वैसे ही रहने दें
        if (cleaned.startsWith('91') && cleaned.length >= 12) {
            return cleaned;
        }
        
        // अगर नंबर 10 डिजिट का है तो आगे 91 लगा दें
        if (cleaned.length === 10) {
            return `91${cleaned}`;
        }
        
        return cleaned;
    };

    // एक्सेल से नंबर्स एक्सट्रैक्ट करने का मॉडिफाइड फंक्शन
    const extractNumbersFromExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    let extractedNumbers = [];
                    for (let row of jsonData) {
                        if (Array.isArray(row)) {
                            for (let cell of row) {
                                if (extractedNumbers.length >= 100) break; // Stop after 100 numbers
                                
                                const cellStr = String(cell);
                                if (/\d{10,}/.test(cellStr)) {
                                    const cleanedNumber = formatPhoneNumber(cellStr);
                                    if (cleanedNumber.length >= 12) {
                                        extractedNumbers.push(cleanedNumber);
                                    }
                                }
                            }
                        }
                        if (extractedNumbers.length >= 100) break;
                    }

                    resolve(extractedNumbers);
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        setFileUploadError(null);

        if (!file) return;

        const fileType = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(fileType)) {
            setFileUploadError("कृपया केवल Excel या CSV फ़ाइल अपलोड करें");
            return;
        }

        try {
            setIsLoading(true);
            const extractedNumbers = await extractNumbersFromExcel(file);

            if (extractedNumbers.length === 0) {
                setFileUploadError("फ़ाइल में कोई वैध नंबर नहीं मिला");
                return;
            }

            setNumbers(extractedNumbers.join(', '));
            setStatus('Numbers loaded successfully from Excel!');
        } catch (err) {
            setFileUploadError("फ़ाइल को पढ़ने में त्रुटि। कृपया सही फॉर्मैट वाली फ़ाइल अपलोड करें।");
        } finally {
            setIsLoading(false);
        }
    };

    // ड्रैग एंड ड्रॉप हैंडलर्स
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const fileType = file.name.split('.').pop().toLowerCase();
            
            if (!['xlsx', 'xls', 'csv'].includes(fileType)) {
                setFileUploadError("कृपया केवल Excel या CSV फ़ाइल अपलोड करें");
                return;
            }

            try {
                setIsLoading(true);
                const extractedNumbers = await extractNumbersFromExcel(file);

                if (extractedNumbers.length === 0) {
                    setFileUploadError("फ़ाइल में कोई वैध नंबर नहीं मिला");
                    return;
                }

                setNumbers(extractedNumbers.join(', '));
                setStatus('Numbers loaded successfully from Excel!');
            } catch (err) {
                setFileUploadError("फ़ाइल को पढ़ने में त्रुटि। कृपया सही फॉर्मैट वाली फ़ाइल अपलोड करें।");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus('');
        setMessageResults([]);

        const numberArray = numbers
            .split(',')
            .map(num => formatPhoneNumber(num.trim()))
            .filter(num => num.length >= 12)
            .slice(0, 100);

        if (numberArray.length === 0) {
            setStatus('Error: Please enter valid phone numbers');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('https://whatsapp-sender.pizeonfly.com/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    numbers: numberArray,
                    message: message
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                setStatus(`Messages sent successfully! (${data.totalSent} sent, ${data.totalFailed} failed)`);
                setMessageResults(data.results);
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (error) {
            setStatus('Failed to connect to the server');
        } finally {
            setIsLoading(false);
        }
    };

    const checkServerStatus = async () => {
        try {
            const response = await fetch('https://whatsapp-sender.pizeonfly.com/status');
            
            if (response.ok) {
                const data = await response.json();
                setServerStatus(data.connected ? "connected" : "disconnected");
                setStatus(null);
            } else {
                throw new Error('Server response not ok');
            }
        } catch (err) {
            console.error('Server status check error:', err);
            setServerStatus("disconnected");
            setStatus("Cannot connect to server. Please make sure the server is running.");
        }
    };

    useEffect(() => {
        checkServerStatus();
        const interval = setInterval(checkServerStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full p-2 sm:p-4 bg-gray-50">
            {/* Header Section */}
            <div className="w-full max-w-5xl mb-2 sm:mb-4 text-center px-2">
                <div className="flex items-center justify-center mb-2">
                    <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-800">
                        WhatsApp Bulk Message Sender
                    </h1>
                </div>
                
                <p className="text-gray-600 max-w-4xl mx-auto text-xs sm:text-sm mb-2 sm:mb-4">
                    Send bulk WhatsApp messages efficiently. Enter numbers manually or upload from Excel files.
                </p>

                <div className="inline-flex items-center justify-center px-2 sm:px-3 py-1 rounded-full bg-gray-50 border border-gray-200 shadow-sm">
                    <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 ${
                        serverStatus === "connected" ? "bg-green-500 animate-pulse" : 
                        serverStatus === "disconnected" ? "bg-red-500" : "bg-yellow-500"
                    }`}></div>
                    <span className="text-xs font-medium text-gray-700">
                        {serverStatus === "connected" ? "Server Online" : 
                        serverStatus === "disconnected" ? "Server Offline" : "Connecting..."}
                    </span>
                </div>
            </div>
            
            <div className="w-full max-w-5xl relative">
                <div className="relative">
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Left Column - Input Form */}
                        <div className="w-full lg:w-1/2 space-y-3 sm:space-y-4">
                            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                                    Upload Excel File
                                </label>
                                <div className="flex items-center justify-center w-full">
                                    <label 
                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all"
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                            </svg>
                                            <p className="mb-2 text-sm text-gray-500">
                                                <span className="font-semibold">Click to upload</span> or drag and drop
                                            </p>
                                            <p className="text-xs text-gray-500">.xlsx, .xls, or .csv</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept=".xlsx,.xls,.csv"
                                            onChange={(e) => handleFileUpload(e)}
                                        />
                                    </label>
                                </div>
                                {fileUploadError && (
                                    <p className="mt-2 text-xs text-red-600">{fileUploadError}</p>
                                )}
                                {isLoading && (
                                    <p className="mt-2 text-xs text-blue-600">Loading numbers from file...</p>
                                )}
                            </div>

                            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <label htmlFor="numbers" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                    Phone Numbers (Manual or from Excel)
                                </label>
                                <textarea
                                    id="numbers"
                                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm"
                                    placeholder="Numbers will appear here after Excel upload, or enter manually"
                                    value={numbers}
                                    onChange={(e) => setNumbers(e.target.value)}
                                    required
                                />
                                <div className="flex justify-between mt-1 sm:mt-2">
                                    <p className="text-xs text-gray-500">Example: 919876543210, 918765432109</p>
                                    <p className="text-xs text-gray-500">
                                        {numbers ? numbers.split(',').filter(n => n.trim()).length : 0} numbers
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <label htmlFor="message" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Message Content</label>
                                <textarea
                                    id="message"
                                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm"
                                    placeholder="Enter your message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                    rows={4}
                                />
                            </div>

                            <button
                                className="w-full py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all transform hover:scale-[1.01] shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center text-sm"
                                onClick={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending Messages...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                        </svg>
                                        Send Messages
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Right Column - Status */}
                        <div className="w-full lg:w-1/2 bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all mt-3 lg:mt-0">
                            <div className="flex justify-between items-center mb-2 sm:mb-3">
                                <h3 className="text-sm sm:text-md font-semibold text-gray-800 flex items-center">
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    Message Status
                                </h3>
                            </div>

                            <div className="h-[500px] overflow-y-auto rounded-lg border border-gray-100 bg-gray-50">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full p-4">
                                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <p className="mt-2 text-sm text-gray-600">Sending messages...</p>
                                    </div>
                                ) : messageResults.length > 0 ? (
                                    <div className="space-y-2 p-3">
                                        {status && (
                                            <div className={`p-3 rounded-lg text-sm mb-3 sticky top-0 z-10 shadow-sm ${
                                                status.includes('Error') 
                                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                                    : 'bg-green-100 text-green-700 border border-green-200'
                                            }`}>
                                                {status}
                                            </div>
                                        )}
                                        <div className="divide-y divide-gray-200">
                                            {messageResults.map((result, index) => (
                                                <div key={index} 
                                                     className="py-3 px-2 flex justify-between items-center hover:bg-white transition-colors duration-150 rounded-lg">
                                                    <div className="flex items-center">
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${
                                                            result.status === 'sent' ? 'bg-green-500' : 'bg-red-500'
                                                        }`}></span>
                                                        <span className="text-sm font-medium text-gray-700">{result.number}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                            result.status === 'sent' 
                                                                ? 'bg-green-100 text-green-800' 
                                                                : 'bg-red-100 text-red-800'
                                                        }`}>
                                                            {result.status}
                                                        </span>
                                                        <span className="text-xs text-gray-500 min-w-[60px]">{result.timestamp}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full p-4">
                                        <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        <p className="text-gray-700 font-medium text-sm">Ready to send messages</p>
                                        <p className="text-xs text-gray-500 mt-1">Enter numbers and message to begin</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Footer */}
            <div className="text-center w-full max-w-5xl mt-3 sm:mt-4 py-2 px-2 sm:px-4">
                <div className="text-xs text-gray-600 font-bold mb-1">DISCLAIMER: Use this service responsibly and in accordance with WhatsApp's terms of service.</div>
                <p className="text-xs text-gray-500">
                    © {new Date().getFullYear()} WhatsApp Bulk Message Sender | All Rights Reserved
                </p>
            </div>
        </div>
    );
};

export default MessageSender;
