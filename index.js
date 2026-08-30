const { createApp, watchEffect } = Vue
let todayCardObserver = null;
document.getElementById("versionText").innerText = "2.0";

//variables for encoding and decoding friend code.
const scheduleToLetter = {
    "11": "A", "12": "B", "13": "C",
    "21": "D", "22": "E", "23": "F",
    "31": "G", "32": "H", "33": "I"
};
const letterToSchedule = Object.fromEntries(
    Object.entries(scheduleToLetter).map(([k, v]) => [v, k])
);

//classes
class Friend {
    constructor(data) {
        this.name = data.name;
        this.schedule = data.schedule;
    }
    wave(day) {
        return this.schedule[day];
    }

}
class User extends Friend {
    constructor(data) {
        super(data);
        this.friends = data.friends.map(friend => new Friend(friend));

    }
    addFriend(friend) {
        friend = new URL(friend).searchParams.get("friend");
        this.friends.push(new Friend(JSON.parse(friend)));
    }
    removeFriend(index) {
        this.friends.splice(index, 1);
    }
    removeFriendBySelf(friend) {
        const index = this.friends.indexOf(friend);
        if (index !== -1) {
            this.removeFriend(index);
        }
    }
    share() {
        const { friends, ...shared } = this;
        return window.location.href + "?share=true&friend=" + JSON.stringify(shared);
        //return "";
    }
    friendCode() {
        //Generate a friend code for the user.
        let schedule = Object.values(this.schedule).join("")
        let code = "";
        for (let i = 0; i < 8; i += 2) {
            const pair = schedule.slice(i, i + 2);
            code += scheduleToLetter[pair];
        }
        return code;
    }
}

//Vue apps
var mainApp = createApp({
    data() {
        return {
            letterDay: 'A',
            scheduleDay: null,
            qrScannerStream: null,
            copyLinkText: "Copy Link",
            user: new User(JSON.parse(localStorage.getItem('user'))),
            intervalID: null,
            friendCode: null,
            friendName: null,
            editModeDay: "A",
            schedule: [],
            today: new Date(),
            debug: window.location.search.includes("debug"),
            showCompactWave: false,
            scheduleViewer: null
        }
    },
    computed: {
        noSchoolToday() {
            return !this.debug && !this.schedule.map(row => row.split(',')[0]).includes(new Date().toISOString().split('T')[0])
        },
        cycleDays() {
            return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        },
        scheduleModalTitle() {
            return this.scheduleViewer === this.user || !this.scheduleViewer?.name
                ? 'Your Schedule'
                : `${this.scheduleViewer.name}'s Schedule`;
        }
    },
    methods: {
        copyLink() {
            navigator.clipboard.writeText(this.user.share())
            this.copyLinkText = "Copied!"
            setTimeout(() => {
                this.copyLinkText = "Copy Link"
            }, 2000)
        },
        deleteData() {
            if (this.$refs.deleteDataButton.confirmed) {
                localStorage.removeItem('user');
                localStorage.removeItem('onboarded');
                window.location.reload();
            } else {
                this.$refs.deleteDataButton.innerText = "Are you sure?";
                this.$refs.deleteDataButton.confirmed = true;
            }
        },
        scanCode(result) { },
        isMobile() {
            return (/Android|iPhone|iPad/i.test(navigator.userAgent))
        },
        addFriendFromCode() {
            let result = "";
            this.friendCode = this.friendCode.toUpperCase();
            for (const char of this.friendCode) {
                if ("ABCDEFGHI".indexOf(char) < 0) {
                    alert("That is not a valid friend code.")
                    return;
                }
                result += letterToSchedule[char];
            }
            const letters = "ABCDEFGHI".split("");
            const schedule = Object.fromEntries(
                letters.map((letter, i) => [letter, parseInt(result[i], 10)])
            );
            this.user.addFriend(window.location.href + "?share=true&friend=" + JSON.stringify({ "name": this.friendName, "schedule": schedule }))
            this.friendCode = null;
            this.friendName = null;
            bootstrap.Modal.getOrCreateInstance(document.getElementById('addFriendModal')).hide();
        },
        openSchedule(person) {
            this.scheduleViewer = person;
            this.$nextTick(() => {
                bootstrap.Modal.getOrCreateInstance(document.getElementById('scheduleModal')).show();
            });
        },
        observeTodayCard() {
            const todayCard = this.$refs.todayCard;

            if (!todayCard || !('IntersectionObserver' in window)) {
                this.showCompactWave = false;
                return;
            }

            todayCardObserver?.disconnect();
            todayCardObserver = new IntersectionObserver(([entry]) => {
                this.showCompactWave = !entry.isIntersecting;
            }, {
                rootMargin: '-88px 0px 0px 0px',
                threshold: 0
            });
            todayCardObserver.observe(todayCard);
        },
        getLunchTimeToday() {
            if (this.scheduleDay) {
                switch (this.user.wave(this.letterDay)) {
                    case 1:
                        if (this.scheduleDay[2] == 4) { return "12:05 - 12:35"} //Advisory
                        return "11:57 - 12:27";
                    case 2:
                        if (this.scheduleDay[2] == 4) { return "12:39 - 1:09" } //Advisory
                        return "12:31 - 1:01";
                    case 3:
                        if (this.scheduleDay[2] == 4) { return "1:13 - 1:43" } //Advisory
                        return "1:05 - 1:35";
                }
            }
            return "Unknown Time"
        }
    },
    created() {
        //save the users data in localStorage whenever modified
        watchEffect(() => {
            localStorage.setItem('user', JSON.stringify(this.user));
        });
        //handle shared schedule in URL
        if (window.location.search.includes("share=true")) {
            console.log("Adding friend from shared URL");
            this.user.addFriend(window.location.href);
            window.location.search = "";
        }
        //load actual school schedule or fake schedule from query.
        if(window.location.search.includes("letterDay=")){
            this.letterDay = window.location.search.split("letterDay=")[1].charAt(0).toUpperCase();
            return;
        }
        fetch("/days.csv").then(response => response.text()).then(data => {
            this.schedule = data.split("\n");
            this.schedule.forEach(day => {
                if (day.split(",")[0] == new Date().toISOString().split('T')[0]) {
                    this.letterDay = day.split(",")[1];
                    this.scheduleDay = day.split(",");
                }
            });
        });
    },
    mounted() {
        this.$nextTick(() => this.observeTodayCard());
        var vm = this;
        var modal = document.querySelector('#addFriendModal')
        if (!this.isMobile()) {
            modal.addEventListener('shown.bs.modal', async () => {
                const video = document.getElementById("qrScanner2");
                this.qrScannerStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });
                video.srcObject = this.qrScannerStream;
                await video.play();

                const detector = new BarcodeDetector({ formats: ["qr_code"] });
                async function scanLoop() {
                    console.log("Scanning...");
                    const codes = await detector.detect(video);
                    if (codes.length) {
                        var result = codes[0].rawValue;
                        if (!result.startsWith(window.location.href + "?share=true")) {
                            alert("Scanned QR code is not a valid LunchByte schedule!");
                            return;
                        }
                        
                        bootstrap.Modal.getOrCreateInstance(document.getElementById('addFriendModal')).hide();
                        vm.user.addFriend(result);
                        return;
                    }
                }
                this.intervalID = setInterval(scanLoop, 500);
            });
            modal.addEventListener('hidden.bs.modal', () => {
                if (this.qrScannerStream) {
                    this.qrScannerStream.getTracks().forEach(track => track.stop());
                }
                clearInterval(this.intervalID);
            });
        }
        new QRCode(document.getElementById("qrcode"), {
            width: 200,
            height: 200
        }).makeCode(this.user.share());
    },
    updated() {
        this.observeTodayCard();
    },
    beforeUnmount() {
        todayCardObserver?.disconnect();
    }

})
if (window.localStorage.getItem('onboarded') == 'true') {
    document.getElementById("onboarding").remove();
    mainApp.mount('#app')
} else {
    document.getElementById("app").remove();
    createApp({
        data() {
            return {
                onboardDay: 0,
                onboardStep: 0,
                user: new User({ name: '', schedule: { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1, 'G': 1, 'H': 1 }, friends: [] })
            }
        },
        methods: {
            nextStep() {
                console.log(this.onboardStep, this.onboardDay);
                if (this.onboardStep == 0) {
                    this.onboardStep = 1;
                } else if(this.onboardDay == 7 && this.onboardStep == 1) {
                    this.onboardStep = 2;
                } else if (this.onboardStep == 2) {
                    window.localStorage.setItem('user', JSON.stringify(this.user));
                    window.localStorage.setItem('onboarded', 'true');
                    window.location.reload();
                } else {
                    this.onboardDay++;
                }
            },
            prevStep() {
                if (this.onboardStep == 0) {
                    return;
                } else if (this.onboardStep == 1 && this.onboardDay == 0) {
                    this.onboardStep = 0;
                } else if (this.onboardStep == 2) {
                    this.onboardStep = 1;
                } else {
                    this.onboardDay--;
                }
            },
            cardClass(day) {
                if (day === this.onboardDay) return "center";
                if (day < 0 || day > 7) return "side hidden";
                return "side";
            },
            isValidDay(day) {
                return day >= 0 && day <= 7
            }
        }
    }).mount('#onboarding')
}
