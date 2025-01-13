import React, { useRef, useEffect, useState } from "react";
import { CameraView } from "expo-camera";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  AppState,
  Alert,
  Image,
  TouchableOpacity,
} from "react-native";
import { db } from "../../firebase"; // Firebase setup
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Firebase Authentication
import { ImageBackground } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function ScanAttendance() {
  const navigation = useNavigation();
  const qrLock = useRef(false); // Prevent multiple scans
  const [scanned, setScanned] = useState(false);
  const [successData, setSuccessData] = useState(null); // Store success screen data
  const auth = getAuth(); // Get current user authentication
  
  // Overlay for QR scanning
  const Overlay = () => (
    <View style={styles.overlay}>
      <View style={styles.frame} />
      <Text style={styles.text}>
        Align the QR code within the frame and hold still to scan.
      </Text>
    </View>
  );

  // Reset qrLock when app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (qrLock.current && nextAppState === "active") {
        qrLock.current = false; // Allow scanning again when app becomes active
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  // Function to fetch teacher data
  const fetchTeacherData = async (uid) => {
    try {
      const teacherDoc = await getDoc(doc(db, "users", uid)); // Fetch user document by UID
      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();
        console.log("Teacher Data Retrieved:", teacherData);

        // Validate teacher data structure
        if (!teacherData.name || !teacherData.photoURL || !teacherData.teacherID) {
          throw new Error("Missing teacher data fields (teacherID, name, photoURL).");
        }

        return teacherData; // Return teacher data
      } else {
        console.error("No teacher found with the provided UID.");
      }
    } catch (error) {
      console.error("Error fetching teacher data:", error);
      return null;
    }
  };

  // Function to handle QR code scan
  const handleBarcodeScanned = async ({ data }) => {
    if (!data || qrLock.current) return;

    qrLock.current = true; // Lock to prevent duplicate scans
    setScanned(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "No authenticated user found.");
        return;
      }
      const uid = user.uid;

      // Fetch teacher data from Firestore
      const teacherData = await fetchTeacherData(uid);
      if (!teacherData) {
        return; // Stop if no teacher data
      }

      const { teacherID, name, photoURL } = teacherData;

      // Get current date and time
      const localDateObj = new Date();

      // Format date as dd/mm/yy
      const formattedDate = `${String(localDateObj.getDate()).padStart(2, "0")}-${String(localDateObj.getMonth() + 1).padStart(2, "0")}-${localDateObj.getFullYear()}`;

      // Get the day of the week
      const day = localDateObj.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kuala_Lumpur" });

      // Get the time
      const time = localDateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kuala_Lumpur",
      });

      // Determine attendance status
      const scanHour = localDateObj.getHours();
      const scanMinute = localDateObj.getMinutes();
      let status = "Absent";

      if (scanHour < 7 || (scanHour === 7 && scanMinute < 30)) {
        status = "Present";
      } else if (scanHour >= 7 && scanMinute >= 30) {
        status = "Late";
      }

      // Save attendance record to Firestore
      const attendanceRef = collection(db, "attendance");
      const docRef = await addDoc(attendanceRef, {
        teacherId: teacherID,
        teacherName: name || "Unknown",
        day,
        date: formattedDate,
        name,
        photoURL,
        status,
        time,
        timestamp: serverTimestamp(), // UTC time
      });

      // Notify LiveAnalyticsScreen about new attendance
      console.log(`Attendance added with ID: ${docRef.id}`);

      // Set success screen data
      setSuccessData({
        teacherId: teacherID,
        teacherName: name,
        photoURL,
        date: formattedDate,
        time,
        status,
        day,
      });

    } catch (error) {
      console.error("Error saving attendance:", error);
      Alert.alert("Error", "Failed to record attendance. Please try again.");
    } finally {
      qrLock.current = false;
      setScanned(false);
    }
  };

  if (successData) {
    return (
      <ImageBackground
        source={require("../assets/background1.png")} // Update with the correct path to your asset
        style={styles.background}
      >
        <SafeAreaView style={styles.successScreen}>
          {/* Header with separated logos */}
          <View style={styles.header}>
            <Image
              source={require("../assets/logosk.png")}
              style={styles.logoLeft}
            />
            <Image
              source={require("../assets/logo.png")}
              style={styles.logoRight}
            />
          </View>

          {/* Title below the logos */}
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}>ATTENDANCE</Text>
            <Text style={styles.successMessage}>
              Attendance was successfully recorded at
            </Text>
            <Text style={styles.timestamp}>
              {successData.date} | {successData.time}
            </Text>
            <Image
              source={{
                uri: successData.photoURL,
              }}
              style={styles.profileImage}
            />
            <Text style={styles.teacherName}>{successData.teacherName}</Text>
            <Text style={styles.teacherId}>{successData.teacherId}</Text>
          </View>

          {/* Footer with Home Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              
              onPress={() => navigation.navigate("HomePage")}
            >
              <Image source={require("../assets/home.png")}
              style={styles.footerIcon}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <SafeAreaView style={StyleSheet.absoluteFillObject}>
      {Platform.OS === "android" ? <StatusBar hidden /> : null}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barCodeScannerSettings={{
          barCodeTypes: ["qr"], // Only scan QR codes
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <Overlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  frame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "white",
    borderRadius: 10,
  },
  text: {
    marginTop: 20,
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  background: {
    flex: 1,
    resizeMode: "cover",
  },
  successScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "90%",
    position: "absolute",
    top: 20,
  },
  logoLeft: {
    width: 130, // Adjust width to your preference
    height: 145, // Adjust height as needed
    resizeMode: "contain",
    marginBottom: 160,
  },
  logoRight: {
    width: 200, // Adjust width to your preference
    height: 210, // Adjust height as needed
    resizeMode: "contain",
    marginTop: -140,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#262261",
    marginBottom: 10,
    marginTop: 5,
    textAlign: "center",
  },
  successContainer: {
    alignItems: "center",
    paddingTop: 30,
    paddingHorizontal: 15,
    backgroundColor: "rgba(211, 213, 229, 0.9)",
    margin: 20,
    borderRadius: 15,
  },
  successMessage: {
    fontSize: 16,
    color: "#000",
    textAlign: "center",
    marginVertical: 10,
  },
  timestamp: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginVertical: 10,
    borderWidth: 3,
    borderColor: "#262261",
  },
  teacherName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#262261",
    marginTop: 5,
  },
  teacherId: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262261",
    paddingVertical: 12,
    borderRadius: 10,
  },
  homeButtonText: {
    color: "#fff",
    fontSize: 18,
    marginLeft: 10,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#130139",
    paddingVertical: 10,
    alignItems: "center",
  },
  footerIcon: {
    width: 50,
    height: 50,
  },
});
