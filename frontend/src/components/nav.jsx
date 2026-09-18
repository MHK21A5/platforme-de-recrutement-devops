import {
  LayoutDashboard,
  Calendar,
  Users,
  User,
  Briefcase,
  Video,
  FileText,
  Shield,
  BarChart2,
  Settings,
} from "lucide-react";

const ico = (C) => <C size={16} strokeWidth={1.8} />;

export const candidateNav = [
  { key: "dashboard",    label: "Dashboard",      icon: ico(LayoutDashboard) },
  { key: "jobs",         label: "Jobs",            icon: ico(Briefcase) },
  { key: "interviews",   label: "Interviews",      icon: ico(Calendar) },
  { key: "calendar",     label: "Calendar",        icon: ico(Calendar) },
  { key: "quizReports",  label: "Quiz Reports",    icon: ico(BarChart2) },
  { key: "interviewPrep",label: "Interview Prep",  icon: ico(Video), href: "/interview-prep" },
  { key: "profile",      label: "My Profile",      icon: ico(User) },
];

export const recruiterNav = [
  { key: "dashboard",    label: "Dashboard",       icon: ico(LayoutDashboard) },
  { key: "interviews",   label: "Interviews",      icon: ico(Calendar) },
  { key: "calendar",     label: "Calendar",        icon: ico(Calendar) },
  { key: "applications", label: "Applications",    icon: ico(FileText) },
  { key: "candidates",   label: "Candidates",      icon: ico(Users) },
  { key: "quizReports",  label: "Quiz Reports",    icon: ico(BarChart2) },
  { key: "profile",      label: "My Profile",      icon: ico(User) },
];

export const adminNav = [
  { key: "overview",     label: "Overview",        icon: ico(LayoutDashboard) },
  { key: "users",        label: "Users",           icon: ico(Users) },
  { key: "jobs",         label: "Jobs",            icon: ico(Briefcase) },
  { key: "interviews",   label: "Interviews",      icon: ico(Calendar) },
  { key: "admin",        label: "Admin",           icon: ico(Shield) },
];
