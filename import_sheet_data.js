const fs = require('fs');
const path = require('path');

// Raw CSV text provided by the user
const rawClearing = `1,RD,2026-03-30,HOMEXPERTS (GURGAON),009939,Axis Bank (India),3145,2026-03-31,2026-04-02,✅ Cleared,View Cheque,,,
2,RD,2026-03-31,SHIV SHAKTI FOAM TRADERS (PITAMPURA),282700,State Bank of India (India),12957,2026-03-31,,❌ Bounced,,,,
3,RD,2026-04-01,BATLA HANDLOOM EMPORIUM PROP HANISH BATLA (LAJPAT NAGAR),575623,State Bank of India (India),47325,2026-03-31,2026-04-02,✅ Cleared,,,,
4,RD,2026-04-01,CHHABRA FASHION PLAZA (RANI BAGH),000619,AU Small Finance Bank (India),13698,2026-03-31,2026-04-02,✅ Cleared,,,,
5,RD,2026-04-01,PADMAWATI FOAM & FURNISHING (ROHINI),956837,Indian Overseas Bank (India),20147,2026-03-31,2026-04-02,✅ Cleared,,,,
6,RD,2026-04-02,HOMEXPERTS (GURGAON),009940,Axis Bank (India),32936,2026-04-01,2026-04-02,✅ Cleared,View Cheque,,,
7,SAF,2026-04-02,STUDIO HOME DECOR (GHAZIABAD),079379,Union Bank of India (India),25000,2026-04-01,,❌ Bounced,,,,
8,RD,2026-04-02,HOME DECOR (NOIDA),002390,HDFC Bank (India),20000,2026-04-02,2026-04-02,✅ Cleared,View Cheque,,,
9,RD,2026-03-04,TANISHKA DECOR (DELHI),237582,Punjab National Bank (India),12731,2026-04-04,2026-04-08,✅ Cleared,View Cheque,,,
10,RD,2026-04-04,ANKUR HANDLOOM AND INTERIOR DECORATORS (GURGAON),366902,Canara Bank (India),28054,2026-04-04,2026-04-08,✅ Cleared,,,,
11,RD,2026-04-04,KHURANA COTTON STORE (RAMESH NAGAR),570477,State Bank of India (India),52318,2026-04-04,2026-04-08,✅ Cleared,,,,
12,RD,2026-04-05,GULATI HANDLOOM (NEW DELHI),000774,Bank of Baroda (India),60549,2026-04-04,2026-04-08,✅ Cleared,,,,
13,RD,2026-04-06,HOMEXPERTS (GURGAON),009941,Axis Bank (India),39367,2026-04-04,2026-04-08,✅ Cleared,,,,
14,RD,2026-04-06,SARABJEET SINGH AHUJA (FARIDABAD),870909,Axis Bank (India),6329,2026-04-04,2026-04-08,✅ Cleared,,,,
15,SAF,2026-04-03,NEW GANGA HANDLOOM (LAXMI NAGAR),001096,City Union Bank Limited (India),36488,2026-04-04,,❌ Bounced,,,,
16,SAF,2026-04-04,HEMKUNT FURNISHING C/O SARABJEET SINGH AHUJA (FARIDABAD),870861,Axis Bank (India),7459,2026-04-04,2026-04-07,✅ Cleared,,,,
17,SAF,2026-04-04,KHURANA COTTON STORE (RAMESH NAGAR),570476,State Bank of India (India),30750,2026-04-04,2026-04-07,✅ Cleared,,,,
18,SAF,2026-04-05,JAI SHREE BALAJI HANDLOOM (SHAHDARA),209284,Axis Bank (India),57524,2026-04-04,2026-04-07,✅ Cleared,,,,
19,SAF,2026-04-05,PADMAWATI FOAM & FURNISHING (ROHINI),956838,Indian Overseas Bank (India),21490,2026-04-04,2026-04-07,✅ Cleared,,,,
20,SAF,2026-04-06,SARABJEET SINGH AHUJA (FARIDABAD),870862,Axis Bank (India),15957,2026-04-04,2026-04-07,✅ Cleared,,,,
21,SAF,2026-04-06,STUDIO HOME DECOR (GHAZIABAD),079378,Union Bank of India (India),8098,2026-04-04,2026-04-07,✅ Cleared,,,,
22,RD,2026-04-07,TANISHKA DECOR (DELHI),608628,State Bank of India (India),31200,2026-04-06,2026-04-08,✅ Cleared,View Cheque,,,
23,SAF,2026-04-07,DIAMOND (LAXMI NAGAR),451358,Punjab National Bank (India),60880,2026-04-06,,❌ Bounced,,,,
24,SAF,2026-04-07,UNIQUE FAB DECORE (OKHLA),634114,Jamia Co-operative Bank (India),15000,2026-04-06,2026-04-08,✅ Cleared,,,,
25,RD,2026-04-07,SHREE DURGA STORE,537261,Canara Bank (India),140000,2026-04-06,2026-04-08,✅ Cleared,,,,
26,RD,2026-04-08,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),891130,Jammu and Kashmir Bank (India),10400,2026-04-07,2026-04-08,✅ Cleared,View Cheque,,,
27,RD,2026-04-08,CHHABRA FASHION PLAZA (RANI BAGH),000620,AU Small Finance Bank (India),9910,2026-04-07,2026-04-08,✅ Cleared,,,,
28,RD,2026-04-08,MEENA FOAM (GURGAON),856827,IDBI Bank (India),7355,2026-04-07,2026-04-08,✅ Cleared,,,,
29,RD,2026-04-08,THE U P HANDLOOM CARPETS AND TRIPAL HOUSE (NOIDA),096460,Deutsche Bank (India),27955,2026-04-07,2026-04-08,✅ Cleared,,,,
30,SAF,2026-04-07,SHARMA INTERIOR (GREATER NOIDA),000320,HDFC Bank (India),39181,2026-04-07,2026-04-07,✅ Cleared,,,,
31,SAF,2026-04-08,PADMAWATI FOAM & FURNISHING (ROHINI),956839,Indian Overseas Bank (India),21490,2026-04-07,2026-04-08,✅ Cleared,,,,
32,SAF,2026-04-08,SARABJEET SINGH AHUJA (FARIDABAD),870863,Axis Bank (India),13125,2026-04-07,2026-04-08,✅ Cleared,,,,
33,SAF,2026-04-09,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),893888,Jammu and Kashmir Bank (India),9000,2026-04-08,2026-04-10,✅ Cleared,View Cheque,,,
34,SAF,2026-04-09,USHA WOOL SHOP (DELHI),552233,Canara Bank (India),15000,2026-04-08,2026-04-10,✅ Cleared,,,,
35,RD,2026-04-08,HOME DECOR (NOIDA),002391,HDFC Bank (India),20448,2026-04-08,2026-04-08,✅ Cleared,,,,
36,SAF,2026-04-10,SARABJEET SINGH AHUJA (FARIDABAD),870864,Axis Bank (India),15000,2026-04-09,2026-04-13,✅ Cleared,View Cheque,,,
37,SAF,2026-04-10,STUDIO HOME DECOR (GHAZIABAD),079376,Union Bank of India (India),25000,2026-04-09,2026-04-13,✅ Cleared,,,,
38,SAF,2026-04-10,THE U P HANDLOOM CARPETS AND TRIPAL HOUSE (NOIDA),017294,Deutsche Bank (India),50000,2026-04-09,2026-04-13,✅ Cleared,,,,
39,RD,2026-04-10,SUNDER JEE HANDLOOM (GURGAON),029320,Axis Bank (India),75000,2026-04-09,2026-04-13,✅ Cleared,,,,
40,RD,2026-04-11,STUDIO HOME DECOR (GHAZIABAD),079384,Union Bank of India (India),7538,2026-04-10,2026-04-15,✅ Cleared,View Cheque,,,
41,RD,2026-04-12,ANGAD HANDLOOM EMPORIUM,237588,Punjab National Bank (India),12756,2026-04-10,2026-04-15,✅ Cleared,,,,
42,RD,2026-04-12,SAINI HANDLOOM (BAHADURGARH),001269,Bank of Baroda (India),26478,2026-04-10,2026-04-15,✅ Cleared,,,,
43,RD,2026-04-13,STUDIO HOME DECOR (GHAZIABAD),079382,Union Bank of India (India),5317,2026-04-10,,❌ Bounced,,,,
44,SAF,2026-04-10,SADHNA HANDLOOM (JALALPUR),000037,HDFC Bank (India),20000,2026-04-10,2026-04-10,✅ Cleared,,,,
45,SAF,2026-04-12,PADMAWATI FOAM & FURNISHING (ROHINI),956840,Indian Overseas Bank (India),21490,2026-04-10,2026-04-15,✅ Cleared,,,,
46,SAF,2026-04-12,SAJAWAT (INDRA MARKET),000725,IDFC FIRST Bank (India),14159,2026-04-10,2026-04-15,✅ Cleared,,,,
47,SAF,2026-04-12,SARABJEET SINGH AHUJA (FARIDABAD),870865,Axis Bank (India),16000,2026-04-10,2026-04-15,✅ Cleared,,,,
48,RD,2026-04-09,KHUSHI DECORS (GHAZIABAD),017051,United Bank of India (India),5500,2026-04-13,2026-04-16,✅ Cleared,View Cheque,,,
49,SAF,2026-04-09,NEW HARYANA HANDLOOM HOUSE (SHAHJAHANPUR),000848,Bandhan Bank (India),15000,2026-04-13,2026-04-16,✅ Cleared,,,,
50,SAF,2026-04-13,NEW GANGA HANDLOOM (LAXMI NAGAR),000686,City Union Bank Limited (India),33994,2026-04-13,2026-04-16,✅ Cleared,,,,
51,SAF,2026-04-14,SARABJEET SINGH AHUJA (FARIDABAD),870866,Axis Bank (India),17000,2026-04-13,2026-04-16,✅ Cleared,,,,
52,SAF,2026-04-14,UNIQUE FAB DECORE (OKHLA),634115,Jamia Co-operative Bank (India),15000,2026-04-13,2026-04-16,✅ Cleared,,,,
53,RD,2026-04-15,CHHABRA FASHION PLAZA (RANI BAGH),000621,AU Small Finance Bank (India),13960,2026-04-15,2026-04-18,✅ Cleared,View Cheque,,,
54,RD,2026-04-16,STUDIO HOME DECOR (GHAZIABAD),079381,Union Bank of India (India),19936,2026-04-15,2026-04-18,✅ Cleared,,,,
55,SAF,2026-04-15,PADMAWATI FOAM & FURNISHING (ROHINI),956842,Indian Overseas Bank (India),21490,2026-04-15,,❌ Bounced,,,,
56,SAF,2026-04-15,THE U P HANDLOOM CARPETS AND TRIPAL HOUSE (NOIDA),017295,Deutsche Bank (India),50000,2026-04-15,,,,,,
57,SAF,2026-04-16,CLASSIC CARPET (GHAZIABAD),081922,United Bank of India (India),19325,2026-04-15,,,,,,
58,SAF,2026-04-16,NARULAS EMPORIUM (KRISHNA NAGAR),083784,United Bank of India (India),11644,2026-04-15,,,,,,
59,SAF,2026-04-16,SARABJEET SINGH AHUJA (FARIDABAD),870867,Axis Bank (India),13614,2026-04-15,,,,,,
60,SAF,2026-04-14,SHARMA INTERIOR (GREATER NOIDA),000321,HDFC Bank (India),39181,2026-04-15,,,,,,
61,SAF,2026-04-17,PADMAWATI FOAM & FURNISHING (ROHINI),956843,Indian Overseas Bank (India),21490,2026-04-16,,,View Cheque,,,
62,SAF,2026-04-18,SARABJEET SINGH AHUJA (FARIDABAD),870868,Axis Bank (India),15593,2026-04-17,,,View Cheque,,,
63,SAF,2026-04-18,USHA WOOL SHOP (DELHI),552236,Canara Bank (India),15000,2026-04-17,,,,,,
64,RD,2026-04-20,ANGAD HANDLOOM EMPORIUM,237586,Punjab National Bank (India),12776,2026-04-18,,,View Cheque,,,
65,RD,2026-04-20,GULATI HANDLOOM (NEW DELHI),000779,Bank of Baroda (India),50000,2026-04-18,,,,,,
66,SAF,2026-04-18,STUDIO HOME DECOR (GHAZIABAD),079377,Union Bank of India (India),25000,2026-04-18,,,,,,
67,SAF,2026-04-19,CLASSIC CARPET (GHAZIABAD),081923,United Bank of India (India),15954,2026-04-18,,,,,,
68,SAF,2026-04-19,HOMEXPERTS (GURGAON),010633,Axis Bank (India),10319,2026-04-18,,,,,,
69,SAF,2026-04-19,JAI SHREE BALAJI HANDLOOM (SHAHDARA),209288,Axis Bank (India),25237,2026-04-18,,,,,,
70,SAF,2026-04-19,PADMAWATI FOAM & FURNISHING (ROHINI),956844,Indian Overseas Bank (India),21490,2026-04-18,,,,,,
71,SAF,2026-04-19,SAJAWAT (INDRA MARKET),000726,IDFC FIRST Bank (India),15225,2026-04-18,,,,,,
72,SAF,2026-04-20,SARABJEET SINGH AHUJA (FARIDABAD),870869,Axis Bank (India),19656,2026-04-18,,,,,,
73,SAF,2026-04-20,THE U P HANDLOOM CARPETS AND TRIPAL HOUSE (NOIDA),017296,Deutsche Bank (India),50000,2026-04-18,,,,,,
74,RD,2026-04-21,HANDLOOM COTTAGE (PASCHIM VIHAR),809154,Axis Bank (India),5753,2026-04-20,,,View Cheque,,,
75,SAF,2026-04-20,SADHNA HANDLOOM (JALALPUR),000038,HDFC Bank (India),20000,2026-04-20,,,,,,
76,SAF,2026-04-20,UNIVERSAL HANDLOOM (GREATER NOIDA),000227,HDFC Bank (India),19120,2026-04-20,,,,,,
77,SAF,2026-04-21,HOMEXPERTS (GURGAON),010634,Axis Bank (India),5985,2026-04-20,,,,,,
78,SAF,2026-04-21,UNIQUE FAB DECORE (OKHLA),634116,Jamia Co-operative Bank (India),15000,2026-04-20,,,,,,
79,RD,2026-04-22,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),891132,Jammu and Kashmir Bank (India),10400,2026-04-21,,,View Cheque,,,
80,RD,2026-04-22,CHHABRA FASHION PLAZA (RANI BAGH),000622,AU Small Finance Bank (India),18409,2026-04-21,,,,,,
81,SAF,2026-04-22,ALLURING DECOR LLP (NEW DELHI),000542,ICICI Bank (India),43979,2026-04-21,,,,,,
82,SAF,2026-04-09,DIAMOND (LAXMI NAGAR),451359,Punjab National Bank (India),60880,2026-04-21,,,,,,
83,SAF,2026-04-22,PADMAWATI FOAM & FURNISHING (ROHINI),956845,Indian Overseas Bank (India),21490,2026-04-21,,,,,,
84,SAF,2026-04-22,SARABJEET SINGH AHUJA (FARIDABAD),870870,Axis Bank (India),13104,2026-04-21,,,,,,
85,SAF,2026-04-22,DREAM CATCHERS FURNISHING (FARIDABAD),002687,HDFC Bank (India),6682,2026-04-22,,,View Cheque,,,
86,SAF,2026-04-23,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),893890,Jammu and Kashmir Bank (India),9000,2026-04-22,,,,,,
87,RD,2026-04-22,CLASSIC CARPET (GHAZIABAD),081925,United Bank of India (India),22524,2026-04-23,,,View Cheque,,,
88,RD,2026-04-24,DEVYANI (KAMLA NAGAR-NEW GST),003080,UCO Bank (India),20000,2026-04-23,,,,,,
89,RD,2026-04-24,SARABJEET SINGH AHUJA (FARIDABAD),870917,Axis Bank (India),5852,2026-04-23,,,,,,
90,SAF,2026-04-22,YANKIES FASHION STUDIO (NEW DELHI),001509,HDFC Bank (India),10000,2026-04-23,,,,,,
91,SAF,2026-04-23,CLASSIC CARPET (GHAZIABAD),081924,United Bank of India (India),15729,2026-04-23,,,,,,
92,SAF,2026-04-24,SARABJEET SINGH AHUJA (FARIDABAD),870872,Axis Bank (India),13974,2026-04-23,,,,,,
93,RD,2026-04-25,BATLA HANDLOOM EMPORIUM PROP HANISH BATLA (LAJPAT NAGAR),168496,State Bank of India (India),34686,2026-04-24,,,View Cheque,,,
94,RD,2026-04-27,ANKUR HANDLOOM AND INTERIOR DECORATORS (GURGAON),006783,Canara Bank (India),25000,2026-04-24,,,,,,
95,RD,2026-04-27,GULATI HANDLOOM (NEW DELHI),000780,Bank of Baroda (India),46371,2026-04-24,,,,,,
96,RD,2026-04-24,JAIN HOME DECOR (DELHI),354748,Canara Bank (India),16796,2026-04-24,,,,,,
97,RD,2026-04-25,CLASSIC CARPET (GHAZIABAD),081932,United Bank of India (India),12054,2026-04-24,,,,,,
98,SAF,2026-04-11,DIAMOND (LAXMI NAGAR),451360,Punjab National Bank (India),60880,2026-04-24,,,,,,
99,SAF,2026-04-23,NEW HARYANA HANDLOOM HOUSE (SHAHJAHANPUR),000849,Bandhan Bank (India),15000,2026-04-24,,,,,,
100,SAF,2026-04-25,PADMAWATI FOAM & FURNISHING (ROHINI),956846,Indian Overseas Bank (India),21490,2026-04-24,,,,,,
101,SAF,2026-04-26,PADMAWATI FOAM & FURNISHING (ROHINI),956847,Indian Overseas Bank (India),21490,2026-04-24,,,,,,
102,SAF,2026-04-26,SAJAWAT (INDRA MARKET),000727,IDFC FIRST Bank (India),18354,2026-04-24,,,,,,
103,SAF,2026-04-26,SARABJEET SINGH AHUJA (FARIDABAD),870871,Axis Bank (India),12049,2026-04-24,,,,,,
104,SAF,2026-04-26,THE U P HANDLOOM CARPETS AND TRIPAL HOUSE (NOIDA),017292,Deutsche Bank (India),50000,2026-04-24,,,,,,
105,RD,2026-04-24,U P HANDLOOM AND KHADI BHANDAR (NOIDA),233224,Axis Bank (India),16218,2026-04-27,,,View Cheque,,,
106,RD,2026-04-26,TANA BANA (PROP NITESH DUBEY),000588,HDFC Bank (India),63134,2026-04-27,,,,,,
107,RD,2026-04-28,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),891133,Jammu and Kashmir Bank (India),10400,2026-04-27,,,,,,
108,SAF,2026-04-27,CHADARWALA HANDLOOM HOUSE (P) LTD (DELHI),000022,HDFC Bank (India),18564,2026-04-27,,,,,,
109,SAF,2026-04-27,UNIVERSAL HANDLOOM (GREATER NOIDA),000228,HDFC Bank (India),10000,2026-04-27,,,,,,
110,SAF,2026-04-28,HOMEXPERTS (GURGAON),010634,Axis Bank (India),4014,2026-04-27,,,,,,
111,SAF,2026-04-28,SARABJEET SINGH AHUJA (FARIDABAD),870873,Axis Bank (India),12500,2026-04-27,,,,,,
112,SAF,2026-04-28,UNIQUE FAB DECORE (OKHLA),634117,Jamia Co-operative Bank (India),15000,2026-04-27,,,,,,
113,SAF,2026-04-28,USHA WOOL SHOP (DELHI),552238,Canara Bank (India),14143,2026-04-27,,,,,,
114,SAF,2026-04-21,SHARMA INTERIOR (GREATER NOIDA),000322,HDFC Bank (India),39181,2026-04-27,,,,,,
115,RD,2026-04-29,ANGAD HANDLOOM EMPORIUM,237589,Punjab National Bank (India),12971,2026-04-28,,,,,,
116,RD,2026-04-29,CHHABRA FASHION PLAZA (RANI BAGH),000623,AU Small Finance Bank (India),20000,2026-04-28,,,,,,
117,SAF,2026-04-28,HOME DECOR (NOIDA),002404,HDFC Bank (India),26000,2026-04-28,,,,,,
118,SAF,2026-04-28,SHARMA INTERIOR (GREATER NOIDA),000323,HDFC Bank (India),39181,2026-04-28,,,,,,
119,SAF,2026-04-29,PADMAWATI FOAM & FURNISHING (ROHINI),956848,Indian Overseas Bank (India),21507,2026-04-28,,,,,,
120,SAF,2026-05-04,SHIVAM HADLOOM ( RANI BAGH ),071898,Axis Bank (India),11222,2026-05-07,,,,,,
121,RD,2026-05-04,SHIVAM HADLOOM ( RANI BAGH ),071899,Axis Bank (India),6426,2026-05-07,,,,,,
122,RD,2026-05-08,CLASSIC CARPET (GHAZIABAD),093116,Union Bank of India (India),44999,2026-05-07,,,,,,
123,RD,2026-05-08,HANDLOOM COTTAGE (PASCHIM VIHAR),837852,Axis Bank (India),6300,2026-05-07,,,,,,
124,RD,2026-05-08,PADMAWATI FOAM & FURNISHING (ROHINI),956950,Indian Overseas Bank (India),27596,2026-05-07,,,,,,`;

const rawHold = `1,SAF,2026-03-13,NEW GANGA HANDLOOM (LAXMI NAGAR),001097,City Union Bank Ltd.,39565,2026-03-13,Hold by Party,Ashok Ji,182,⏸ On Hold,,View Cheque,,,
2,SAF,2026-04-03,NEW GANGA HANDLOOM (LAXMI NAGAR),000685,City Union Bank Ltd.,33994,2026-04-03,Hold by Party,Ashok Ji,161,⏸ On Hold,,View Cheque,,,
3,SAF,2026-04-11,DIAMOND (LAXMI NAGAR),451360,Punjab National Bank,60880,2026-04-08,Hold By Raju Ji till 15 Apr,Raju Ji,156,⏸ On Hold,,View Cheque,,,
4,RD,2026-04-15,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),891131,J&K Bank,10400,2026-04-15,Hold by Party,Hold by Party,149,⏸ On Hold,,View Cheque,,,
5,SAF,2026-04-16,CHANDNI CHOWK SELECTION (PROP-RISHI ARORA),893889,J&K Bank,9000,2026-04-15,Hold by Party,Hold by Party,149,⏸ On Hold,,View Cheque,,,`;

const rawReturned = `1,RD,2026-03-27,AVADH HANDLOOM FURNISHING (PRATAP MARKET),972622,State Bank of India,34490,2026-04-01,Insufficient Funds,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
2,SAF,2026-03-29,SAMRAT SAREES (ROPAR),007988,Central Bank of Indis,20000,2026-04-02,Exceeds Aggangement,Sent to PNP,🟢 Recovered,,View Cheque,,,,
3,RD,2026-03-31,MONA FURNISHING HOUSE (LUCKNOW),903709,Punjab Natonal Bank,28247,2026-04-04,Exceeds Aggangement,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
4,RD,2026-03-30,STUDIO HOME DECOR (GHAZIABAD),079368,Union Bank of India,4187,2026-04-04,Insufficient Funds,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
5,RD,2026-03-28,CLASSIC CARPET (GHAZIABAD),081771,Union Bank of India,41466,2026-04-04,Insufficient Funds,Sent to PNP,🟢 Recovered,,View Cheque,,,,
6,RD,2026-03-27,STUDIO HOME DECOR (GHAZIABAD),074160,Union Bank of India,8347,2026-04-04,Insufficient Funds,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
7,RD,2026-03-28,STUDIO HOME DECOR (GHAZIABAD),074158,Union Bank of India,8374,2026-04-04,Insufficient Funds,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
8,RD,2026-04-03,SPACE FURNISHING (RAMPUR),949753,State Bank of India,29817,2026-04-03,Insufficient Funds,Sent to PNP,🟢 Recovered,,View Cheque,,,,
9,RD,2026-03-31,SHIV SHAKTI FOAM TRADERS (PITAMPURA),282700,State Bank of India,12957,2026-04-07,Insufficient Funds,💰 Recovered in Cash,🟢 Recovered,,View Cheque,,,,
10,SAF,2026-04-02,STUDIO HOME DECOR (GHAZIABAD),079379,Union Bank of India,25000,2026-04-02,Exceeds Aggangement,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
11,RD,2026-04-05,MAYA SILK STORE,000145,Punjab & Sind Bank,30033,2026-04-09,Exceeds Aggangement,Sent to PNP,🟢 Recovered,,View Cheque,,,,
12,SAF,2026-03-03,NEW GANGA HANDLOOM (LAXMI NAGAR),001096,City Union Bank Ltd.,36488,2026-04-10,Insufficient Funds,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
13,SAF,2026-04-07,DIAMOND (LAXMI NAGAR),451358,Punjab National Bank,60880,2026-04-11,Insufficient Funds,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
14,RD,2026-04-15,DECOR VATIKA (LUDHIANA),001026,ICICI Bank,24730,2026-04-17,Insufficient Funds,,🟢 Recovered,,View Cheque,,,,
15,SAF,2026-04-11,SAMRAT SAREES (ROPAR),008056,Central Bank of Indis,21725,2026-04-17,Exceeds Aggangement,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
16,RD,2026-04-20,DECOR STUDIO (AMBALA),769197,Indian Bank,25000,2026-04-25,Payee Name Differ,Sent to PNP,🔴 Unresolved,,View Cheque,,,,
17,SAF,2026-06-28,SARABJEET SINGH AHUJA (FARIDABAD),870904,Axix Bank,9060,2026-07-06,Insufficient Funds,💰 Recovered in Cash,🟢 Recovered,,#ERROR!,,,,
18,RD,2026-06-30,HOMEXPERTS (GURGAON),039912,Axix Bank,8823,2026-07-06,Alternation In date,Sent to PNP,🔴 Unresolved,,,,,,
19,SAF,2026-03-07,NEW GANGA HANDLOOM (LAXMI NAGAR),000694,City Union Bank Ltd.,27909,2026-07-14,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
20,RD,2026-07-15,tanishka decor,571265,State Bank of India,10475,2026-07-18,Signature Mismatch,🔄 Under Follow-Up,🟡 In Progress,,,,,,
21,SAF,2026-07-13,NEW GANGA HANDLOOM (LAXMI NAGAR),000695,City Union Bank Ltd.,32000,2026-07-18,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
22,RD,2026-07-18,apna chawala,002636,Punjab & Sind Bank,20000,2026-07-21,Exceeds Aggangement,Rakesh Bhaiya,🟡 In Progress,,,,,,
23,SAF,2026-07-22,NEW GANGA HANDLOOM (LAXMI NAGAR),000696,City Union Bank Ltd.,32885,2026-07-28,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
24,RD,2026-07-27,shree Durga Store,537276,Canara Bank,166124,2026-07-31,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
25,SAF,2026-08-03,AVADH HANDLOOM FURNISHING (PRATAP MARKET),136935,SBI,31303,2026-08-06,Other,Sent to PNP,🔴 Unresolved,,,,,,
26,SAF,2026-08-03,Emson Home Furnishing (Panchkula),001917,AU Small Finance Bank,25000,2026-08-06,Other,Sent to PNP,🔴 Unresolved,,,,,,
27,SAF,2026-08-03,NEW GANGA HANDLOOM (LAXMI NAGAR),000697,City Union Bank Ltd.,29127,2026-08-11,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
28,SAF,2026-08-09,MEENA FORM GG,863077,IDBI BANK,30000,2026-08-13,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
29,RD,2026-08-07,APNA CHAWLA HANDLOOM (MATHURA),002635,Punjab & Sind Bank,20000,2026-08-13,Exceeds Aggangement,Rakesh Sir,🟡 In Progress,,,,,,
30,RD,2026-08-06,APNA CHAWLA HANDLOOM (MATHURA),002633,Punjab & Sind Bank,20000,2026-08-13,Exceeds Aggangement,Rakesh Sir,🟡 In Progress,,,,,,
31,RD,2026-07-18,APNA CHAWLA HANDLOOM (MATHURA),002636,Punjab & Sind Bank,20000,2026-08-13,Exceeds Aggangement,Rakesh Sir,🟡 In Progress,,,,,,
32,RD,2026-08-10,SAMRAT SAREES (ROPAR),044479,Central Bank of India,13149,2026-08-14,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
33,RD,2026-08-08,APNA CHAWLA HANDLOOM (MATHURA),002637,Punjab & Sind Bank,20000,2026-08-14,Exceeds Aggangement,Rakesh Sir,🟡 In Progress,,,,,,
34,RD,2026-08-18,APNA CHAWLA HANDLOOM (MATHURA),002638,Punjab & Sind Bank,20000,2026-08-21,Exceeds Aggangement,Rakesh Sir,🟡 In Progress,,,,,,
35,RD,2026-08-17,SUPER INTERNATIONAL HANDLOOM (PATIALA),010339,UCO Bank,8162,2026-08-22,Other,Sent to PNP,🔴 Unresolved,,,,,,
36,SAF,2026-08-27,unique fav d,634133,Jamia Co-operative Bank,11500,2026-08-18,Other,Sent to PNP,🔴 Unresolved,,,,,,
37,SAF,2026-08-28,SHRE KRISHNA HANDLOOM,001297,HDFC BANK,100000,2026-08-31,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
38,RD,2026-08-27,shree Durga Store,537281,CANARA BANK,140000,2026-08-31,Exceeds Aggangement,💰 Recovered in Cash,🟢 Recovered,,,,,,
39,SAF,2026-08-23,NEW GANGA HANDLOOM (LAXMI NAGAR),000698,City Union Bank Ltd.,42680,2026-09-03,Insufficient Funds,Rakesh Sir,🔴 Unresolved,,,,,,
40,SAF,2026-08-27,the courtain hub,000115,HDFC Bank,14000,2026-09-08,Alternation In date,Sent to PNP,🔴 Unresolved,,,,,,
41,SAF,2026-09-07,SHIV HANDLOOM (CHANDOUSY),227739,SBI,10000,2026-09-09,Exceeds Aggangement,Sent to PNP,🔴 Unresolved,,,,,,
42,RD,2026-09-08,APNA CHAWLA HANDLOOM (MATHURA),002639,Punjab & Sind Bank,20000,2026-09-10,Exceeds Aggangement,Rakesh Sir,🟡 In Progress,,,,,,
43,SAF,2026-07-07,NEW GANGA HANDLOOM (LAXMI NAGAR),000694,City Union Bank Ltd.,27909,2026-09-10,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
44,SAF,2026-07-13,NEW GANGA HANDLOOM (LAXMI NAGAR),000695,City Union Bank Ltd.,32000,2026-09-10,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
45,SAF,2026-08-03,NEW GANGA HANDLOOM (LAXMI NAGAR),000697,City Union Bank Ltd.,29127,2026-09-10,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,
46,SAF,2026-07-22,NEW GANGA HANDLOOM (LAXMI NAGAR),000696,City Union Bank Ltd.,32885,2026-09-10,Insufficient Funds,Sent to PNP,🔴 Unresolved,,,,,,`;

function parseLine(line) {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur.trim());
  return parts;
}

const allItems = [];

// 1. Parse Clearing
rawClearing.trim().split('\n').forEach((line, idx) => {
  if (!line.trim()) return;
  const p = parseLine(line);
  if (!p[0] || isNaN(parseInt(p[0]))) return;
  const sr = parseInt(p[0]);
  const firm = p[1] || 'RD'; // RD or SAF
  const chequeDate = p[2] || '';
  const partyName = p[3] || '';
  const chequeNumber = p[4] || '';
  const bankName = p[5] || '';
  const amount = parseFloat(p[6]) || 0;
  const sentDate = p[7] || '';
  const clearDate = p[8] || '';
  const statusRaw = p[9] || '';
  const photo = p[10] && p[10].includes('View') ? '/uploads/cheques/sample-cheque.svg' : '';

  let status = 'SENT_FOR_CLEARING';
  if (statusRaw.includes('Cleared')) status = 'CLEARED';
  else if (statusRaw.includes('Bounced')) status = 'BOUNCED';
  else if (!sentDate) status = 'IN_HAND';

  allItems.push({
    id: `CLR-${String(sr).padStart(4, '0')}`,
    firm: firm.toUpperCase().includes('SAF') ? 'SAF' : 'RD',
    moduleType: 'CLEARING', // CLEARING, HOLD, RETURNED
    srNo: sr,
    chequeNumber,
    partyName,
    bankName,
    branch: '',
    amount,
    chequeDate,
    clearingDate: sentDate || chequeDate,
    sentToBankDate: sentDate,
    actualClearDate: clearDate,
    status,
    chequePhoto: photo,
    receiptPhoto: status === 'CLEARED' ? '/uploads/receipts/sample-deposit-slip.svg' : '',
    remarks: '',
    createdAt: new Date().toISOString()
  });
});

// 2. Parse Hold
rawHold.trim().split('\n').forEach((line) => {
  if (!line.trim()) return;
  const p = parseLine(line);
  if (!p[0] || isNaN(parseInt(p[0]))) return;
  const sr = parseInt(p[0]);
  const firm = p[1] || 'SAF';
  const chequeDate = p[2] || '';
  const partyName = p[3] || '';
  const chequeNumber = p[4] || '';
  const bankName = p[5] || '';
  const amount = parseFloat(p[6]) || 0;
  const holdDate = p[7] || chequeDate;
  const holdReason = p[8] || 'Hold by Party';
  const instructionBy = p[9] || 'Ashok Ji';
  const releaseDate = p[12] || '';

  allItems.push({
    id: `HLD-${String(sr).padStart(4, '0')}`,
    firm: firm.toUpperCase().includes('SAF') ? 'SAF' : 'RD',
    moduleType: 'HOLD',
    srNo: sr,
    chequeNumber,
    partyName,
    bankName,
    branch: '',
    amount,
    chequeDate,
    clearingDate: releaseDate || chequeDate,
    holdDate,
    holdReason,
    instructionBy,
    status: 'ON_HOLD',
    chequePhoto: '/uploads/cheques/sample-cheque.svg',
    receiptPhoto: '',
    remarks: `Hold by ${instructionBy}: ${holdReason}`,
    createdAt: new Date().toISOString()
  });
});

// 3. Parse Returned
rawReturned.trim().split('\n').forEach((line) => {
  if (!line.trim()) return;
  const p = parseLine(line);
  if (!p[0] || isNaN(parseInt(p[0]))) return;
  const sr = parseInt(p[0]);
  const firm = p[1] || 'RD';
  const chequeDate = p[2] || '';
  const partyName = p[3] || '';
  const chequeNumber = p[4] || '';
  const bankName = p[5] || '';
  const amount = parseFloat(p[6]) || 0;
  const returnDate = p[7] || '';
  const returnReason = p[8] || 'Insufficient Funds';
  const actionTaken = p[9] || 'Sent to PNP';
  const recoveryStatus = p[10] || '🔴 Unresolved';
  const redepositDate = p[11] || '';

  allItems.push({
    id: `RET-${String(sr).padStart(4, '0')}`,
    firm: firm.toUpperCase().includes('SAF') ? 'SAF' : 'RD',
    moduleType: 'RETURNED',
    srNo: sr,
    chequeNumber,
    partyName,
    bankName,
    branch: '',
    amount,
    chequeDate,
    clearingDate: redepositDate || returnDate || chequeDate,
    returnDate,
    returnReason,
    actionTaken,
    recoveryStatus: recoveryStatus.includes('Recovered') ? 'RECOVERED' : (recoveryStatus.includes('Progress') ? 'IN_PROGRESS' : 'UNRESOLVED'),
    redepositDate,
    status: recoveryStatus.includes('Recovered') ? 'RECOVERED' : 'BOUNCED',
    chequePhoto: '/uploads/cheques/sample-cheque.svg',
    receiptPhoto: '',
    remarks: `Action: ${actionTaken} (${recoveryStatus})`,
    createdAt: new Date().toISOString()
  });
});

const database = {
  settings: {
    firms: [
      { id: 'RD', name: 'Reliable Drapes', color: 'blue', badge: '🔵 RD' },
      { id: 'SAF', name: 'Shree Ambica Furnishings India Pvt Ltd', color: 'green', badge: '🟢 SAF' }
    ],
    defaultSirName: 'Nisar Sir',
    defaultActionPersons: ['Sent to PNP', 'Rakesh Sir', 'Ashok Ji', 'Raju Ji', 'Nisar Sir']
  },
  cheques: allItems
};

const DB_FILE = path.join(__dirname, 'data', 'cheques.json');
fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf8');

console.log(`Successfully imported ${allItems.length} records into ${DB_FILE}!`);
console.log(`- Clearing: ${allItems.filter(x => x.moduleType === 'CLEARING').length}`);
console.log(`- Hold: ${allItems.filter(x => x.moduleType === 'HOLD').length}`);
console.log(`- Returned: ${allItems.filter(x => x.moduleType === 'RETURNED').length}`);
