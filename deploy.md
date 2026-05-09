ssh -i C:\Users\panch\ai_avatar.pem ubuntu@34.226.92.16





































<!-- 


We calculated Projected Lift by estimating how many extra customers an event can bring to the Subway store.

Instead of using only distance, we considered multiple business factors:

Distance from store → closer events have higher chances of bringing customers
Attendees count → more people means more potential customers
Event type → conferences, concerts, sports events, weddings, etc.
Food availability → if food is already provided at the event, fewer people will visit Subway
Time relevance → lunch/dinner time events are more valuable for a food business

Then we calculate an estimated conversion probability and apply it to the attendee count.

Final formula:

Projected Lift=Attendees×Conversion Rate×Event Factors×10

Projected Lift=Attendees×Conversion Rate×Event Factors×10

Example

Suppose:

Event has 5000 attendees
Distance from Subway = 0.2 miles
Event type = Conference
No food provided
Time = Lunch
Average customer spend = $10

Base conversion for 0.2 miles = 15%

Formula:

5000×0.15×1.0×1.0×1.2×10

5000×0.15×1.0×1.0×1.2×10=9000

Projected Lift = $9,000

This gives a more realistic business prediction instead of only using distance. -->











<!-- 



direct production-grade sources hain. 
 https://www.sf.gov/events/upcoming   
   https://www.sftravel.com/things-to-do/events  
    https://www.paloalto.gov/Departments/City-Clerk/City-Council/City-Council-Committee-Meetings   
      https://www.destinationpaloalto.com/calendar/#!/   
        https://events.stanford.edu/   
           https://ose.stanford.edu/upcoming-events   
             https://www.paloaltonetworks.com/resources/event-calendar  
                https://www.paloaltoonline.com/calendar/ 
                  https://allevents.in/palo-alto   #!/  -->











<!-- 


I own a Subway restaurant located in Palo Alto, California, and I want you to act like a highly experienced local business intelligence analyst for restaurants. Your task is to identify and analyze all relevant events happening within Palo Alto, Menlo Park, Stanford, Redwood City, Mountain View, East Palo Alto, and nearby surrounding areas during the next 7–10 days. I want a highly detailed and structured event intelligence report specifically focused on events that could potentially increase customer traffic to my Subway location. Please search across all possible event sources including city event calendars, Stanford University calendars, Stanford athletics and Stanford Live events, Eventbrite, Meetup, Patch, Facebook Events, Instagram event pages, local newspapers, tourism websites, community organizations, business networking groups, libraries, schools, sports schedules, concert venues, cultural organizations, nonprofit events, parks and recreation calendars, downtown associations, and any other local event platforms.

For every event you find, provide detailed information including: event name, exact date, start and end time, event category (concert, conference, family event, sports event, meetup, workshop, festival, community event, cultural event, education event, etc.), venue name, exact address, estimated distance from my Subway location in Palo Alto, expected audience type (families, students, tourists, professionals, teenagers, sports fans, etc.), estimated attendance or crowd size if possible, whether food is available at the venue or not, whether outside food options nearby are limited, and whether attendees are likely to search for quick food options before or after the event. I especially want you to prioritize and identify events where there are limited food vendors, no strong food options nearby, large foot traffic, long-duration events, sports events, family gatherings, student gatherings, concerts, outdoor community events, or events where attendees may leave the venue looking for fast and affordable food like Subway.

In addition, for each event, identify the organizer or hosting organization and provide as much organizer information as possible including organizer name, company or institution name, contact person if available, email address, phone number, website, LinkedIn profile, Instagram page, Facebook page, sponsorship or vendor contact page, and whether the event may be open to restaurant partnerships, catering opportunities, coupon distribution, sponsorships, or food collaborations. Also analyze whether the event audience is a good fit for Subway customers and explain why the event may or may not generate additional customer traffic for my restaurant.

I want the final output in a highly detailed table format sorted by highest business opportunity first. Include a “Restaurant Opportunity Score” from 1–10 for every event based on expected foot traffic, food availability nearby, audience fit, distance from my restaurant, and likelihood of attendees purchasing food from Subway. Also provide strategic recommendations for each event such as: run sandwich combo promotions, increase staffing during specific hours, distribute coupons, target students, create family meal deals, stay open later, increase delivery readiness, or contact organizers for partnerships. I want this report to be extremely practical, business-focused, and optimized for maximizing restaurant revenue opportunities during the next 7–10 days. -->





 ssh -i C:\Users\panch\ai_avatar.pem ubuntu@34.226.92.16
sudo cat /etc/systemd/system/geoevents-backend.service
sudo cat /etc/systemd/system/new-frontend.service
sudo systemctl status geoevents-backend
sudo systemctl status new-frontend









Score & Projected Lift Calculation
Exact formula samajhna:

SCORE = Distance + Attendance + Type + Audience Bonus + Timing Bonus + Food Penalty
Har component alag explain:

Component	Range	Kya depend karta hai
Distance Score	0-25 pts	Event kitna paas hai store se
Attendance Score	5-25 pts	Event mein kitne log expected hain
Type Score	3-18 pts	Event ka type (sports=18, music=16, conference=14, etc)
Audience Bonus	0-10+ pts	Students/professionals/sports fans = zyada
Timing Bonus	0-10 pts	Dinner time (5-9pm) = 10 pts, lunch = 6 pts
Food Penalty	-15 to 0	Agar event mein khana included hai = -15
Final	20-99 pts	(clamped between 20 minimum aur 99 maximum)
Example: Concert 0.2 miles away, 500 people, 7pm

PROJECTED LIFT = Attendance × Conversion Rate × $10 (per event)
Conversion Rate = Distance Factor × Event Factor × Food Factor × Time Factor

Factor	Formula	Range	Example
Distance	Based on miles	0.02-0.20	0.1 miles = 0.20 (20%)
Event	Type-based multiplier	0.5-1.1	Sports = 1.1x (high intent)
Food	Is food served?	0.3-1.0	Full meal = 0.3x, no food = 1.0x
Time	Event hour	0.5-1.2	Dinner 5-9pm = 1.2x (peak)
Example: Sports event 0.1 miles, 500 attendance, 6pm, no food

Summary:

Score = ordaining events by relevance (20-99)
Projected Lift = revenue potential ($10 per cover) summed across all qualified events
Filtered by selected category and date range
Only events with score ≥ 50 count as "High Opportunity"