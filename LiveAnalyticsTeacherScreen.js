import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import background11 from "../assets/background11.png";
import logo from "../assets/logo.png";
import logosk from "../assets/logosk.png";

const LiveAnalyticsScreen = ({ navigation }) => {
  const [analyticsData, setAnalyticsData] = useState({
    weeklyAttendance: [], // Holds timestamps for the past week
    totalSchoolDays: 0,
    totalSchoolHolidays: 0,
  });
  const [teacherID, setTeacherID] = useState(null); // Store the teacherID
  const [loading, setLoading] = useState(true);

  // Function to format date to dd/mm/yyyy and add the day
  const formatDate = (timestamp) => {
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const date = new Date(timestamp);
    
    const day = daysOfWeek[date.getDay()]; // Get the day of the week
    const dayOfMonth = String(date.getDate()).padStart(2, "0"); // Day of the month, e.g. '09'
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Month, e.g. '01'
    const year = date.getFullYear(); // Full year, e.g. '2025'
    
    return `${day}, ${dayOfMonth}/${month}/${year}`; // Format: "Monday, 09/01/2025"
  };

  // Fetch user data and teacherID
  useEffect(() => {
    const fetchUserData = async () => {
        try {
            const currentUser = auth.currentUser;
            
            if (currentUser) {
                console.log("Current User UID:", currentUser.uid);
                const userDocRef = doc(db, "users", currentUser.uid); // Using doc() to reference the document
                const userDocSnap = await getDoc(userDocRef); // Using getDoc() to fetch the document
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    console.log("User Data:", userData);
                    if (userData.teacherID) {
                        setTeacherID(userData.teacherID); // Set teacherID
                    } else {
                        console.error("teacherID is missing in Firestore document");
                    }
                } else {
                    console.error("No document found for UID:", currentUser.uid);
                }
            } else {
                console.error("No user is currently logged in.");
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchUserData();
  }, []);

  // Fetch analytics data for teacherID
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    // Access the teacher's analytics document using their UID
    const docRef = doc(db, "teacherAttendanceAnalytics", currentUser.uid);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("Fetched data:", data); // Log the fetched data

          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          const filteredAttendance = (data.weeklyAttendance || []).filter(
            (record) => {
              // Convert Firestore Timestamp to JavaScript Date
              const timestamp = record.toDate ? record.toDate() : new Date(record);

              console.log("Attendance record:", timestamp); // Log each record for inspection
              return timestamp >= oneWeekAgo;
            }
          );

          setAnalyticsData({
            weeklyAttendance: filteredAttendance,
            totalSchoolDays: data.totalSchoolDays || 0,
            totalSchoolHolidays: data.totalSchoolHolidays || 0,
          });
        } else {
          console.log("No such document!");
        }
      },
      (error) => {
        console.error("Error fetching analytics data: ", error);
        Alert.alert("Error", "Failed to fetch analytics data.");
      }
    );

    return () => unsubscribe(); // Cleanup on component unmount
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!teacherID) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Teacher ID is missing or invalid.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background */}
      <Image source={background11} style={styles.background} resizeMode="cover" />

      {/* Header with Logos */}
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image source={logo} style={styles.logoLeft} />
          <Image source={logosk} style={styles.logoRight} />
        </View>
        <Text style={styles.headerText}>Teacher Analytics</Text>
      </View>

      {/* Statistics Table */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.statisticsTable}>
          {[{ title: "Total School Days", value: analyticsData.totalSchoolDays, color: "#bca9e1" },
          { title: "Total School Holidays", value: analyticsData.totalSchoolHolidays, color: "#ffe0f1" }].map((stat, index) => (
            <View
              key={index}
              style={[styles.statisticsCell, { backgroundColor: stat.color }]} >
              <Text style={styles.statTitle}>{stat.title}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Attendance Log */}
        <Text style={styles.chartTitle}>Weekly Attendance Log</Text>
        <View style={styles.timestampContainer}>
          {analyticsData.weeklyAttendance.length > 0 ? (
            analyticsData.weeklyAttendance.map((record, index) => {
              const timestamp = record.toDate ? record.toDate() : new Date(record);
              return (
                <View key={index} style={styles.timestampEntry}>
                  <Text style={styles.timestampDate}>
                    {formatDate(timestamp)}
                  </Text>
                  <Text style={styles.timestampTime}>
                    {timestamp.toLocaleTimeString("en-US")}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.noDataText}>No attendance records for the past week.</Text>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate("HomePage")}>
          <Image source={require("../assets/home.png")} style={styles.footerIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  background: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  headerContainer: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#130139",
  },
  logoContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    alignItems: "center",
  },
  logoLeft: {
    width: 150,
    height: 100,
    resizeMode: "contain",
    marginRight: 10,
    marginBottom: -15,
  },
  logoRight: {
    width: 110,
    height: 130,
    resizeMode: "contain",
    marginLeft: 10,
  },
  headerText: {
    fontSize: 25,
    fontWeight: "bold",
    textAlign: "center",
    color: "#FFFFFF",
    marginTop: -20,
    marginBottom: 10,
  },
  scrollContainer: {
    padding: 16,
  },
  statisticsTable: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
    width: "100%",
  },
  statisticsCell: {
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    flex: 1,
    marginHorizontal: 5,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000000",
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    textAlign: "center",
  },
  timestampContainer: {
    marginTop: 20,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 10,
  },
  timestampEntry: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
    padding: 10,
    borderBottomColor: "#D3D3D3",
    borderBottomWidth: 1,
  },
  timestampDate: {
    fontSize: 16,
    fontWeight: "bold",
  },
  timestampTime: {
    fontSize: 16,
    color: "#333333",
  },
  noDataText: {
    textAlign: "center",
    color: "#333333",
    fontStyle: "italic",
    marginVertical: 10,
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
    top:-15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#333",
  },
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
  },
});

export default LiveAnalyticsScreen;
