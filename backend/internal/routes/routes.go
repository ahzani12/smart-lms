package routes

import (
	"smart-lms/internal/handlers"
	"smart-lms/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

func Setup(app *fiber.App) {
	api := app.Group("/api")

	// ─── Auth (Public) ──────────────────────────────────
	auth := api.Group("/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/parent-login", handlers.ParentLogin)

	// ─── Auth (Protected) ──────────────────────────────
	authAPI := api.Group("/auth", middleware.AuthRequired)
	authAPI.Get("/profile", handlers.GetProfile)
	authAPI.Put("/profile", handlers.UpdateProfile)
	authAPI.Put("/password", handlers.ChangePassword)

	// ─── Dashboard ─────────────────────────────────────
	dash := api.Group("/dashboard", middleware.AuthRequired)
	dash.Get("/", handlers.GetDashboard)

	// ─── Users ─────────────────────────────────────────
	users := api.Group("/users", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"))
	users.Get("/", handlers.GetUsers)
	users.Post("/", handlers.CreateUser)
	users.Put("/:id", handlers.UpdateUser)
	users.Delete("/:id", handlers.DeleteUser)
	users.Post("/:id/reset-password", handlers.ResetUserPassword)
	users.Post("/bulk-reset-password", handlers.BulkResetPassword)
	users.Get("/password-reset-logs", handlers.GetPasswordResetLogs)

	// ─── Students ──────────────────────────────────────
	students := api.Group("/students", middleware.AuthRequired)
	students.Get("/", handlers.GetStudents)
	students.Get("/unassigned", handlers.GetUnassignedStudents)
	students.Get("/:id", handlers.GetStudent)
	students.Post("/", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.CreateStudent)
	students.Put("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateStudent)
	students.Delete("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteStudent)
	students.Post("/import", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.ImportStudents)

	// ─── Teachers ──────────────────────────────────────
	teachers := api.Group("/teachers", middleware.AuthRequired)
	teachers.Get("/", handlers.GetTeachers)
	teachers.Get("/:id", handlers.GetTeacher)
	teachers.Post("/", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.CreateTeacher)
	teachers.Put("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateTeacher)
	teachers.Delete("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteTeacher)

	// ─── Classes ───────────────────────────────────────
	classes := api.Group("/classes", middleware.AuthRequired)
	classes.Get("/", handlers.GetClasses)
	classes.Get("/:id", handlers.GetClass)
	classes.Post("/", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.CreateClass)
	classes.Put("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateClass)
	classes.Delete("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteClass)
	classes.Get("/:id/students", handlers.GetClassStudents)
	classes.Post("/:id/assign-students", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.AssignStudentsToClass)
	classes.Post("/:id/unassign-students", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UnassignStudentsFromClass)


	// ─── Subjects ──────────────────────────────────────
	subjects := api.Group("/subjects", middleware.AuthRequired)
	subjects.Get("/", handlers.GetSubjects)
	subjects.Post("/", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.CreateSubject)
	subjects.Put("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateSubject)
	subjects.Delete("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteSubject)

	// ─── Semesters ─────────────────────────────────────
	semesters := api.Group("/semesters", middleware.AuthRequired)
	semesters.Get("/", handlers.GetSemesters)
	semesters.Post("/", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.CreateSemester)
	semesters.Put("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateSemester)
	semesters.Delete("/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteSemester)

	// ─── Topics (BAB/KD) ───────────────────────────────
	topics := api.Group("/topics", middleware.AuthRequired)
	topics.Get("/", handlers.GetTopics)
	topics.Post("/", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.CreateTopic)
	topics.Put("/:id", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.UpdateTopic)
	topics.Delete("/:id", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.DeleteTopic)

	// ─── Question Banks ────────────────────────────────
	banks := api.Group("/question-banks", middleware.AuthRequired)
	banks.Get("/template-docx", handlers.DownloadQuestionTemplate) // sebelum /:id
	banks.Get("/", handlers.GetQuestionBanks)
	banks.Get("/:id", handlers.GetQuestionBank)
	banks.Post("/", middleware.RoleRequired("guru", "admin_pusat"), handlers.CreateQuestionBank)
	banks.Put("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.UpdateQuestionBank)
	banks.Delete("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.DeleteQuestionBank)

	// Bank Items (m2m)
	banks.Get("/:id/items", handlers.GetBankItems)
	banks.Post("/:id/items", middleware.RoleRequired("guru", "admin_pusat"), handlers.AddBankItems)
	banks.Delete("/:id/items/:item_id", middleware.RoleRequired("guru", "admin_pusat"), handlers.RemoveBankItem)
	banks.Put("/:id/items/reorder", middleware.RoleRequired("guru", "admin_pusat"), handlers.ReorderBankItems)

	// Import dari Word (.docx)
	banks.Post("/:id/import-docx-preview", middleware.RoleRequired("guru", "admin_pusat"), handlers.ImportDocxPreview)
	banks.Post("/:id/import-docx-commit", middleware.RoleRequired("guru", "admin_pusat"), handlers.ImportDocxCommit)

	// Import Word → bank
	banks.Post("/:bank_id/import-word", middleware.RoleRequired("guru", "admin_pusat"), handlers.ImportQuestionsFromWord)

	// ─── Questions (Pool) ──────────────────────────────
	questions := api.Group("/questions", middleware.AuthRequired)
	questions.Get("/pool", handlers.GetQuestionPool)
	questions.Get("/:id", handlers.GetQuestion)
	questions.Get("/:id/versions", handlers.GetQuestionVersions)
	questions.Post("/", middleware.RoleRequired("guru", "admin_pusat"), handlers.CreateQuestion)
	questions.Post("/bulk", middleware.RoleRequired("guru", "admin_pusat"), handlers.CreateQuestionsBulk)
	questions.Put("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.UpdateQuestion)
	questions.Delete("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.DeleteQuestion)

	// ─── Exams ─────────────────────────────────────────
	exams := api.Group("/exams", middleware.AuthRequired)
	exams.Get("/", handlers.GetExams)
	exams.Get("/:id", handlers.GetExam)
	exams.Post("/", middleware.RoleRequired("guru", "admin_pusat"), handlers.CreateExam)
	exams.Put("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.UpdateExam)
	exams.Delete("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.DeleteExam)
	exams.Post("/:id/start", middleware.RoleRequired("guru", "admin_pusat"), handlers.StartExam)
	exams.Post("/:id/end", middleware.RoleRequired("guru", "admin_pusat"), handlers.EndExam)

	exams.Get("/:id/questions", middleware.RoleRequired("siswa"), handlers.GetExamQuestions)
	exams.Post("/:id/submit", middleware.RoleRequired("siswa"), handlers.SubmitExam)
	exams.Post("/:id/tab-switch", middleware.RoleRequired("siswa"), handlers.ReportTabSwitch)

	exams.Get("/:id/monitoring", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.GetExamMonitoring)
	exams.Get("/:id/attempts-list", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.GetAttemptsList)
	exams.Get("/:id/analysis", middleware.RoleRequired("guru", "admin_pusat"), handlers.GetItemAnalysis)

	// Teacher grading + attempt admin
	attempts := api.Group("/exam-attempts", middleware.AuthRequired, middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"))
	attempts.Get("/:id", handlers.GetAttemptDetail)
	attempts.Delete("/:id", handlers.ResetAttempt)
	api.Put("/exam-answers/:id/grade", middleware.AuthRequired, middleware.RoleRequired("guru", "admin_pusat"), handlers.GradeAnswer)

	// Siswa: daftar attempt miliknya sendiri
	api.Get("/my-attempts", middleware.AuthRequired, middleware.RoleRequired("siswa"), handlers.GetMyAttempts)

	// ─── Attendance (Schedule + Session + Presence) ────
	sched := api.Group("/schedules", middleware.AuthRequired)
	sched.Get("/", handlers.GetSchedules)
	sched.Get("/today", handlers.GetMyTodaySchedules)
	sched.Post("/", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.CreateSchedule)
	sched.Put("/:id", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.UpdateSchedule)
	sched.Delete("/:id", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.DeleteSchedule)

	attendance := api.Group("/attendance", middleware.AuthRequired)
	attendance.Get("/sessions", handlers.ListAttendanceSessions)
	attendance.Get("/sessions/:id", handlers.GetAttendanceSession)
	attendance.Post("/sessions/open", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.OpenAttendanceSession)
	attendance.Post("/sessions/:id/close", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.CloseAttendanceSession)
	attendance.Post("/sessions/:id/mark", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.MarkPresenceManual)
	attendance.Post("/scan", middleware.RoleRequired("siswa"), handlers.MarkPresenceSelfQR)
	attendance.Get("/summary", handlers.GetAttendanceSummary)
	attendance.Get("/teacher-summary", handlers.GetTeacherAttendanceSummary)

	// ─── Asisten (Rule-based command parser) ───────────
	asisten := api.Group("/assistant", middleware.AuthRequired)
	asisten.Post("/parse", handlers.AssistantParse)
	asisten.Post("/resolve", handlers.AssistantResolve)
	asisten.Post("/execute", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang", "wali_kelas"), handlers.AssistantExecute)
	asisten.Post("/undo", middleware.RoleRequired("guru", "admin_pusat", "admin_cabang", "wali_kelas"), handlers.AssistantUndo)
	asisten.Get("/log", handlers.AssistantGetLog)

	// ─── Raport ────────────────────────────────────────
	raport := api.Group("/raport", middleware.AuthRequired)
	raport.Get("/", handlers.GetRaports)
	raport.Get("/download-class", middleware.RoleRequired("superadmin", "admin_pusat", "admin_cabang", "guru"), handlers.DownloadRaportClass)
	raport.Get("/:id", handlers.GetRaport)
	raport.Post("/", middleware.RoleRequired("guru", "admin_pusat"), handlers.CreateRaport)
	raport.Put("/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.UpdateRaport)
	raport.Post("/generate", middleware.RoleRequired("guru", "admin_pusat"), handlers.GenerateRaportFromExams)

	// ─── School ────────────────────────────────────────
	school := api.Group("/school", middleware.AuthRequired)
	school.Get("/", handlers.GetSchool)
	school.Put("/", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateSchool)
	school.Post("/logo", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UploadSchoolLogo)
	// Asset dokumen (kop, stempel, TTD)
	school.Get("/doc-assets", handlers.GetSchoolDocAssets)
	school.Post("/doc-logo", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UploadLogoSekolah)
	school.Post("/doc-stempel", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UploadStempel)
	school.Post("/doc-ttd-kepala", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UploadTTDKepala)
	school.Post("/doc-ttd-bendahara", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UploadTTDBendahara)
	// Lokasi & anti fake-GPS
	school.Get("/location", handlers.GetSchoolLocation)
	school.Put("/location", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpdateSchoolLocation)
	school.Get("/location-logs", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.GetTeacherLocationLogs)

	// ─── Calendar ──────────────────────────────────────
	calendar := api.Group("/calendar", middleware.AuthRequired)
	calendar.Get("/events", handlers.GetEvents)
	calendar.Post("/events", middleware.RoleRequired("admin_pusat", "admin_cabang", "guru"), handlers.CreateEvent)
	calendar.Put("/events/:id", middleware.RoleRequired("admin_pusat", "admin_cabang", "guru"), handlers.UpdateEvent)
	calendar.Delete("/events/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteEvent)
	calendar.Get("/check-holiday", handlers.CheckHoliday)
	calendar.Get("/holidays", handlers.GetHolidaysInRange)
	calendar.Get("/libur-nasional", handlers.GetLiburNasional)
	calendar.Post("/sync-libur-nasional", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.SyncLiburNasional)

	// ─── AI ────────────────────────────────────────────
	ai := api.Group("/ai", middleware.AuthRequired)
	ai.Get("/configs", middleware.RoleRequired("admin_pusat"), handlers.GetAIConfigs)
	ai.Post("/configs", middleware.RoleRequired("admin_pusat"), handlers.CreateAIConfig)
	ai.Put("/configs/:id", middleware.RoleRequired("admin_pusat"), handlers.UpdateAIConfig)
	ai.Delete("/configs/:id", middleware.RoleRequired("admin_pusat"), handlers.DeleteAIConfig)
	ai.Post("/configs/:id/activate", middleware.RoleRequired("admin_pusat"), handlers.SetActiveAI)
	ai.Post("/fetch-models", middleware.RoleRequired("admin_pusat"), handlers.FetchAIModels)
	// School AI config (hybrid)
	ai.Get("/school-config", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.GetSchoolAIConfig)
	ai.Post("/school-config", middleware.RoleRequired("admin_pusat"), handlers.SaveSchoolAIConfig)
	ai.Delete("/school-config/:id", middleware.RoleRequired("admin_pusat"), handlers.DeleteSchoolAIConfig)
	// Resolve (used by AI Hub to get active config)
	ai.Get("/resolve", handlers.ResolveAIConfig)
	ai.Post("/usage", handlers.IncrementAIUsage)

	// OAuth ChatGPT — start requires auth, callback is public (redirect from OpenAI)
	ai.Post("/oauth/chatgpt/start", middleware.RoleRequired("admin_pusat"), handlers.OAuthChatGPTStart)
	api.Get("/ai/oauth/chatgpt/callback", handlers.OAuthChatGPTCallback)

	// ─── Leaderboard ────────────────────────────────────────
	api.Get("/leaderboard", middleware.AuthRequired, handlers.GetLeaderboard)

	// ─── Parent Portal ───────────────────────────────────────
	parent := api.Group("/parent", middleware.AuthRequired)
	parent.Get("/dashboard", middleware.RoleRequired("orang_tua"), handlers.GetParentDashboard)
	parent.Get("/children", middleware.RoleRequired("orang_tua"), handlers.GetParentChildren)

	// Admin manage parents
	api.Get("/parents", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.GetParents)
	api.Post("/parents", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.CreateParent)
	api.Delete("/parents/:id", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteParent)

	// ─── Parent Access (Login Ortu via Kode) ─────────────────
	pa := api.Group("/parent-access", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"))
	pa.Get("/", handlers.GetParentAccessList)
	pa.Post("/generate", handlers.BulkGenerateParentAccess)
	pa.Get("/export-csv", handlers.ExportParentAccessCSV)
	pa.Put("/:id", handlers.UpdateParentAccess)
	pa.Post("/:id/regenerate", handlers.RegenerateCode)

	// Parent portal data (accessible with parent token)
	api.Get("/parent/portal", middleware.AuthRequired, handlers.ParentPortalData)

	// ─── Report Components (Setting Komponen Raport) ─────────
	rc := api.Group("/report-components", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"))
	rc.Get("/", handlers.GetReportComponents)
	rc.Post("/", handlers.CreateReportComponent)
	rc.Put("/:id", handlers.UpdateReportComponent)
	rc.Delete("/:id", handlers.DeleteReportComponent)

	// ─── Student Scores (Input Nilai) ────────────────────────
	api.Get("/student-scores", middleware.AuthRequired, middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.GetStudentScores)
	api.Post("/student-scores", middleware.AuthRequired, middleware.RoleRequired("guru", "admin_pusat", "admin_cabang"), handlers.SaveStudentScores)

	// ─── Generate Raport ─────────────────────────────────────
	api.Post("/generate-raport", middleware.AuthRequired, middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.GenerateRaport)

	ai.Post("/generate-questions", middleware.RoleRequired("guru", "admin_pusat"), handlers.AIGenerateQuestions)
	ai.Get("/jobs/:id", middleware.RoleRequired("guru", "admin_pusat"), handlers.GetAIJob)
	ai.Post("/grade-essay", middleware.RoleRequired("guru", "admin_pusat"), handlers.AIGradeEssay)
	ai.Post("/generate-rpp", middleware.RoleRequired("guru", "admin_pusat"), handlers.AIGenerateRPP)
	ai.Post("/generate-protapromes", middleware.RoleRequired("guru", "admin_pusat"), handlers.AIGenerateProtaPromes)

	// ─── Superadmin ───────────────────────────────────────────
	super := api.Group("/super", middleware.AuthRequired, middleware.RoleRequired("superadmin"))
	super.Get("/overview", handlers.SuperOverview)
	super.Get("/schools", handlers.SuperGetSchools)
	super.Get("/schools/:id", handlers.SuperGetSchool)
	super.Post("/schools", handlers.SuperCreateSchool)
	super.Put("/schools/:id", handlers.SuperUpdateSchool)
	super.Delete("/schools/:id", handlers.SuperDeleteSchool)
	super.Get("/admins", handlers.SuperGetAdmins)
	super.Post("/admins", handlers.SuperCreateAdmin)
	super.Put("/admins/:id", handlers.SuperUpdateAdmin)
	super.Delete("/admins/:id", handlers.SuperDeleteAdmin)
	super.Post("/admins/:id/reset-password", handlers.SuperResetPassword)
	// AI Config (global)
	super.Get("/ai-configs", handlers.SuperGetAIConfigs)
	super.Post("/ai-configs", handlers.SuperCreateAIConfig)
	super.Put("/ai-configs/:id", handlers.SuperUpdateAIConfig)
	super.Delete("/ai-configs/:id", handlers.SuperDeleteAIConfig)
	// AI Quota
	super.Get("/ai-quotas", handlers.SuperGetAIQuotas)
	super.Post("/ai-quotas", handlers.SuperSetAIQuota)
	super.Post("/ai-quotas/:id/reset", handlers.SuperResetQuota)

	// ─── Notifikasi WA/Telegram (per-sekolah, opsional) ─────────
	notif := api.Group("/notifications", middleware.AuthRequired)
	notif.Get("/config", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.GetNotificationConfig)
	notif.Put("/config", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.UpsertNotificationConfig)
	notif.Post("/test", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.TestNotification)
	notif.Get("/queue", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.ListNotifications)
	notif.Post("/queue/:id/retry", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.RetryNotification)
	notif.Delete("/queue/:id", middleware.RoleRequired("admin_pusat", "admin_cabang"), handlers.DeleteNotification)

	// ─── Keuangan / Billing ──────────────────────────────────────
	billing := api.Group("/billing", middleware.AuthRequired)
	adminOnly := middleware.RoleRequired("admin_pusat", "admin_cabang")

	// Jenis tagihan (master)
	billing.Get("/jenis", middleware.AuthRequired, handlers.GetJenisTagihan)
	billing.Post("/jenis", adminOnly, handlers.CreateJenisTagihan)
	billing.Put("/jenis/:id", adminOnly, handlers.UpdateJenisTagihan)
	billing.Delete("/jenis/:id", adminOnly, handlers.DeleteJenisTagihan)

	// Tagihan
	billing.Post("/generate", adminOnly, handlers.GenerateTagihan)
	billing.Get("/tagihan", handlers.GetTagihanList)
	billing.Get("/tagihan/:id", handlers.GetTagihanDetail)
	billing.Get("/siswa/:id", handlers.GetTagihanSiswa)
	billing.Put("/tagihan/:id", adminOnly, handlers.UpdateTagihan)
	billing.Delete("/tagihan/:id", adminOnly, handlers.CancelTagihan)

	// Pembayaran
	billing.Post("/bayar", adminOnly, handlers.CreatePembayaran)
	billing.Post("/pembayaran/:id/void", adminOnly, handlers.VoidPembayaran)
	billing.Get("/pembayaran/:id/kuitansi", handlers.PrintKuitansi)

	// Potongan (master + assign)
	billing.Get("/potongan", handlers.GetPotongan)
	billing.Post("/potongan", adminOnly, handlers.CreatePotongan)
	billing.Put("/potongan/:id", adminOnly, handlers.UpdatePotongan)
	billing.Delete("/potongan/:id", adminOnly, handlers.DeletePotongan)
	billing.Get("/potongan/:id/students", handlers.GetPotonganStudents)
	billing.Post("/potongan/:id/students", adminOnly, handlers.AssignPotonganStudents)
	billing.Delete("/potongan/student/:id", adminOnly, handlers.UnassignPotonganStudent)
	billing.Get("/siswa/:id/potongan", handlers.GetStudentPotongan)

	// Dashboard
	billing.Get("/dashboard", adminOnly, handlers.GetBillingDashboard)
}
