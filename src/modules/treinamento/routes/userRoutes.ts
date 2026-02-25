import { Router } from "express"
import {
  getByCpf,
  listAllUsers,
  listCompanyEmployeeObras,
  listCompanyEmployees,
  listCompanySections,
  listCourses,
  listInstructorUsers,
  updateInstructors,
} from "../controllers/userController"

const router = Router()

router.get("/instructors", listInstructorUsers)
router.put("/instructors", updateInstructors)
router.get("/employees/obras", listCompanyEmployeeObras)
router.get("/employees", listCompanyEmployees)
router.get("/sections", listCompanySections)
router.get("/", listAllUsers)
router.get("/:cpf", getByCpf)
router.get("/:cpf/courses", listCourses)

export default router
