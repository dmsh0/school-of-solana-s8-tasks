///-------------------------------------------------------------------------------
///
/// This is your first task to get warmed up and see how useful traits can be.
///
/// Complete the implementation of methods in the Rectangle and Circle structs,
/// then implement the Shape trait for both structs.
///
/// Tasks:
/// 1. Implement Rectangle struct methods (constructor, setters, getters)
/// 2. Implement Circle struct methods (constructor, setter, getter)
/// 3. Implement the Shape trait for both Rectangle and Circle
/// 4. Handle validation errors properly using the Error enum
///
///-------------------------------------------------------------------------------

pub trait Shape {
    fn area(&self) -> f64;
    fn perimeter(&self) -> f64;
}

pub struct Rectangle {
    width: f64,
    height: f64,
}

pub struct Circle {
    radius: f64,
}

#[derive(Debug, PartialEq)]
pub enum Error {
    InvalidWidth,
    InvalidHeight,
    InvalidRadius,
}

// TODO: Implement constructor with setters and getters.
//
// Width and height are considered invalid if they are negative.
// All methods should return the corresponding error when invalid values are provided.
impl Rectangle {
    pub const MAX_DIM: f64 = 1.340_780_792_994_259_6e154; // f64::MAX.sqrt()

    pub fn validate_dim(dim: f64) -> bool {
        if !dim.is_finite() || dim <= 0.0 || dim > Self::MAX_DIM {
            return false;
        }
        true
    }

    pub fn new(width: f64, height: f64) -> Result<Self, Error> {
        if !Self::validate_dim(width) {
            return Err(Error::InvalidWidth);
        }
        if !Self::validate_dim(height) {
            return Err(Error::InvalidHeight);
        }
        Ok(Self { width, height })
    }

    pub fn set_width(&mut self, width: f64) -> Result<(), Error> {
        if !Self::validate_dim(width) {
            return Err(Error::InvalidWidth);
        }
        self.width = width;
        Ok(())
    }

    pub fn set_height(&mut self, height: f64) -> Result<(), Error> {
        if !Self::validate_dim(height) {
            return Err(Error::InvalidHeight);
        }
        self.height = height;
        Ok(())
    }

    pub fn get_width(&self) -> f64 {
        self.width
    }

    pub fn get_height(&self) -> f64 {
        self.height
    }
}

// TODO: Implement constructor with setter and getter.
//
// The radius is considered invalid if it is negative.
// All methods should return the corresponding error when invalid values are provided.
impl Circle {
    pub const MAX_RADIUS: f64 = 7.564545572282618e153; // (f64::MAX / std::f64::consts::PI).sqrt()

    pub fn validate_radius(radius: f64) -> bool {
        if !radius.is_finite() || radius.is_nan() || radius <= 0.0 || radius > Self::MAX_RADIUS {
            return false;
        }
        true
    }

    pub fn new(radius: f64) -> Result<Self, Error> {
        if !Self::validate_radius(radius) {
            return Err(Error::InvalidRadius);
        }
        Ok(Self { radius })
    }

    pub fn set_radius(&mut self, radius: f64) -> Result<(), Error> {
        if !Self::validate_radius(radius) {
            return Err(Error::InvalidRadius);
        }
        self.radius = radius;
        Ok(())
    }

    pub fn get_radius(&self) -> f64 {
        self.radius
    }
}

// TODO: Implement the Shape trait for both Rectangle and Circle structs.
//
// Hint: Use std::f64::consts::PI to calculate the area and circumference of the circle.
impl Shape for Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
    fn perimeter(&self) -> f64 {
        2.0 * self.width + 2.0 * self.height
    }
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
    fn perimeter(&self) -> f64 {
        2.0 * std::f64::consts::PI * self.radius
    }
}
